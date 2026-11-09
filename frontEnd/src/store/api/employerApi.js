import { api, toFormData } from './baseApi.js';

const applicantsTag = jobId => ({ type: 'Applicants', id: String(jobId) });

/** Next scheduled interview (1h grace), matching the server's rule. */
function nextInterviewAt(interviews = []) {
  const cutoff = Date.now() - 3600000;
  const next = interviews
    .filter(i => i.status === 'scheduled' && new Date(i.scheduledAt).getTime() >= cutoff)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0];
  return next?.scheduledAt || null;
}

/**
 * After a mutation returns the full application, write it straight into the caches:
 * the detail panel and the matching card in every cached list for that job. The UI updates
 * instantly; the tag invalidation that follows only confirms it.
 */
async function syncApplication({ dispatch, getState, queryFulfilled }) {
  let application;
  try {
    ({ data: { application } } = await queryFulfilled);
  } catch {
    return;
  }
  if (!application) return;
  dispatch(employerApi.util.upsertQueryData('getApplication', application.id, application));
  employerApi.util.selectInvalidatedBy(getState(), [applicantsTag(application.jobId)])
    .filter(entry => entry.endpointName === 'getApplicants')
    .forEach(entry => dispatch(employerApi.util.updateQueryData('getApplicants', entry.originalArgs, draft => {
      const card = draft.find(a => a.id === application.id);
      if (!card) return;
      card.stage = application.stage;
      card.noteCount = application.notes?.length ?? card.noteCount;
      card.score = application.score;
      card.scoreStatus = application.scoreStatus;
      card.nextInterviewAt = nextInterviewAt(application.interviews);
    })));
}
// Mutations that return the full application refresh that application and its job's list.
const appTags = (result, error, { id }) => error ? [] : [
  { type: 'Application', id },
  ...(result?.application?.jobId ? [applicantsTag(result.application.jobId)] : []),
  'EmployerJobs'
];

/** Employer ATS endpoints: company, jobs, pipeline, interviews, team, billing. */
export const employerApi = api.injectEndpoints({
  endpoints: build => ({
    // ----- Company -----
    getEmployerCompany: build.query({ query: () => '/employer/company', transformResponse: r => r.company, providesTags: ['Company'] }),
    updateEmployerCompany: build.mutation({
      query: body => ({ url: '/employer/company', method: 'PATCH', body }),
      invalidatesTags: (r, e) => (e ? [] : ['Company', 'EmployerJobs', 'PublicJobs', 'CompanyPage'])
    }),
    uploadLogo: build.mutation({
      query: blob => ({ url: '/employer/company/logo', method: 'PUT', body: toFormData({ logo: new File([blob], 'logo.png', { type: blob.type || 'image/png' }) }) }),
      invalidatesTags: (r, e) => (e ? [] : ['Company', 'EmployerJobs', 'PublicJobs', 'PublicJob', 'CompanyPage'])
    }),
    removeLogo: build.mutation({
      query: () => ({ url: '/employer/company/logo', method: 'DELETE' }),
      invalidatesTags: ['Company', 'EmployerJobs', 'PublicJobs', 'PublicJob', 'CompanyPage']
    }),

    // ----- Dashboard -----
    // Refreshes whenever jobs, pipelines or interviews change (those mutations invalidate these tags).
    getEmployerOverview: build.query({ query: () => '/employer/overview', providesTags: ['EmployerJobs', 'Interviews'] }),

    // ----- Jobs -----
    getEmployerJobs: build.query({ query: () => '/employer/jobs', transformResponse: r => r.jobs, providesTags: ['EmployerJobs'] }),
    getEmployerJob: build.query({ query: id => `/employer/jobs/${id}`, transformResponse: r => r.job, providesTags: (r, e, id) => [{ type: 'EmployerJob', id }] }),
    createJob: build.mutation({
      query: body => ({ url: '/employer/jobs', method: 'POST', body }),
      transformResponse: r => r.job,
      invalidatesTags: (r, e) => (e ? [] : ['EmployerJobs', 'PublicJobs', 'Billing', 'Stats', 'CompanyPage'])
    }),
    updateJob: build.mutation({
      query: ({ id, ...body }) => ({ url: `/employer/jobs/${id}`, method: 'PATCH', body }),
      transformResponse: r => r.job,
      invalidatesTags: (r, e, { id }) => (e ? [] : ['EmployerJobs', { type: 'EmployerJob', id }, 'PublicJobs', { type: 'PublicJob', id }, 'Billing', 'Stats', 'CompanyPage'])
    }),

    // AI writer for the job form (doesn't change server data, so no tags).
    generateJobDescription: build.mutation({
      query: body => ({ url: '/employer/jobs/generate-description', method: 'POST', body })
    }),

    // ----- Pipeline -----
    getApplicants: build.query({
      query: ({ jobId, sort = 'score' }) => ({ url: `/employer/jobs/${jobId}/applications`, params: { sort } }),
      transformResponse: r => r.applicants,
      providesTags: (r, e, { jobId }) => [applicantsTag(jobId)]
    }),
    getApplication: build.query({ query: id => `/employer/applications/${id}`, transformResponse: r => r.application, providesTags: (r, e, id) => [{ type: 'Application', id }] }),
    moveApplication: build.mutation({
      query: ({ id, stage }) => ({ url: `/employer/applications/${id}`, method: 'PATCH', body: { stage } }),
      // Optimistic: the card moves (list + board) the moment it's dropped; undone if the server refuses.
      async onQueryStarted({ id, stage, jobId }, { dispatch, queryFulfilled, getState }) {
        const patches = employerApi.util.selectInvalidatedBy(getState(), [applicantsTag(jobId)])
          .filter(entry => entry.endpointName === 'getApplicants')
          .map(entry => dispatch(employerApi.util.updateQueryData('getApplicants', entry.originalArgs, draft => {
            const card = draft.find(a => a.id === id);
            if (card) card.stage = stage;
          })));
        const detail = dispatch(employerApi.util.updateQueryData('getApplication', id, draft => { draft.stage = stage; }));
        try {
          const { data } = await queryFulfilled;
          dispatch(employerApi.util.upsertQueryData('getApplication', id, data.application));
        } catch {
          patches.forEach(p => p.undo());
          detail.undo();
        }
      },
      invalidatesTags: (r, e) => (e ? [] : ['EmployerJobs', 'Interviews'])
    }),
    addNote: build.mutation({
      query: ({ id, text }) => ({ url: `/employer/applications/${id}/notes`, method: 'POST', body: { text } }),
      onQueryStarted: (arg, api) => syncApplication(api),
      invalidatesTags: appTags
    }),
    rescore: build.mutation({ query: ({ id }) => ({ url: `/employer/applications/${id}/rescore`, method: 'POST' }), invalidatesTags: (r, e, { id, jobId }) => (e ? [] : [{ type: 'Application', id }, applicantsTag(jobId), 'Billing']) }),

    // ----- Interviews -----
    scheduleInterview: build.mutation({
      query: ({ id, ...body }) => ({ url: `/employer/applications/${id}/interviews`, method: 'POST', body }),
      onQueryStarted: (arg, api) => syncApplication(api),
      invalidatesTags: (r, e, arg) => (e ? [] : [...appTags(r, e, arg), 'Interviews'])
    }),
    updateInterview: build.mutation({
      query: ({ id, interviewId, status }) => ({ url: `/employer/applications/${id}/interviews/${interviewId}`, method: 'PATCH', body: { status } }),
      onQueryStarted: (arg, api) => syncApplication(api),
      invalidatesTags: (r, e, arg) => (e ? [] : [...appTags(r, e, arg), 'Interviews'])
    }),
    getInterviews: build.query({ query: () => '/employer/interviews', transformResponse: r => r.interviews, providesTags: ['Interviews'] }),
    getReferrals: build.query({ query: () => '/employer/referrals', providesTags: ['Referrals'] }),
    updatePipeline: build.mutation({
      query: stages => ({ url: '/employer/company/pipeline', method: 'PUT', body: { stages } }),
      invalidatesTags: (r, e) => (e ? [] : ['Company', 'EmployerJobs', 'Applicants', 'Application', 'Referrals'])
    }),

    // ----- Billing -----
    getBilling: build.query({ query: () => '/employer/billing', providesTags: ['Billing'] }),
    checkout: build.mutation({
      query: plan => ({ url: '/employer/billing/checkout', method: 'POST', body: { plan } }),
      async onQueryStarted(plan, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.summary) dispatch(employerApi.util.upsertQueryData('getBilling', undefined, data.summary));
        } catch {}
      }
    }),
    verifyPayment: build.mutation({
      query: body => ({ url: '/employer/billing/verify', method: 'POST', body }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(employerApi.util.upsertQueryData('getBilling', undefined, data));
        } catch {}
      }
    }),
    downgrade: build.mutation({
      query: () => ({ url: '/employer/billing/downgrade', method: 'POST' }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(employerApi.util.upsertQueryData('getBilling', undefined, data));
        } catch {}
      }
    })
  })
});

export const {
  useGetEmployerCompanyQuery, useUpdateEmployerCompanyMutation, useUploadLogoMutation, useRemoveLogoMutation,
  useGetEmployerOverviewQuery, useGetEmployerJobsQuery, useGetEmployerJobQuery, useCreateJobMutation, useUpdateJobMutation, useGenerateJobDescriptionMutation,
  useGetApplicantsQuery, useGetApplicationQuery, useMoveApplicationMutation, useAddNoteMutation, useRescoreMutation,
  useScheduleInterviewMutation, useUpdateInterviewMutation, useGetInterviewsQuery, useGetReferralsQuery, useUpdatePipelineMutation,
  useGetBillingQuery, useCheckoutMutation, useVerifyPaymentMutation, useDowngradeMutation
} = employerApi;
