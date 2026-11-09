import { api, toFormData } from './baseApi.js';

/** Public board + candidate endpoints. */
export const publicApi = api.injectEndpoints({
  endpoints: build => ({
    getStats: build.query({ query: () => '/stats', providesTags: ['Stats'] }),
    getPlans: build.query({ query: () => '/plans', transformResponse: r => r.plans, providesTags: ['Plans'] }),

    // Infinite list: one cache entry per filter set; page 2, 3… are appended to it.
    searchJobs: build.query({
      query: params => ({ url: '/jobs', params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null)) }),
      serializeQueryArgs: ({ endpointName, queryArgs }) => {
        const { page, ...filters } = queryArgs;
        return `${endpointName}(${JSON.stringify(filters)})`;
      },
      merge: (current, incoming, { arg }) => {
        if (arg.page > 1) {
          const seen = new Set(current.jobs.map(j => j.id));
          current.jobs.push(...incoming.jobs.filter(j => !seen.has(j.id)));
          current.page = incoming.page;
          current.pages = incoming.pages;
          current.total = incoming.total;
          return current;
        }
        return incoming;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ['PublicJobs']
    }),
    getJob: build.query({ query: id => `/jobs/${id}`, providesTags: (r, e, id) => [{ type: 'PublicJob', id }] }),
    getCompanyPage: build.query({ query: slug => `/companies/${encodeURIComponent(slug)}`, providesTags: (r, e, slug) => [{ type: 'CompanyPage', id: slug }] }),

    // ----- Candidate -----
    getMyApplications: build.query({ query: () => '/me/applications', transformResponse: r => r.applications, providesTags: ['MyApplications'] }),
    getMyResume: build.query({ query: () => '/me/resume', transformResponse: r => r.resume, providesTags: ['MyResume'] }),
    saveMyResume: build.mutation({
      query: ({ file, text }) => ({ url: '/me/resume', method: 'PUT', body: toFormData({ resume: file, text }) }),
      invalidatesTags: ['MyResume']
    }),
    checkFit: build.mutation({
      query: ({ jobId, file, text }) => ({ url: `/jobs/${jobId}/fit`, method: 'POST', body: toFormData({ resume: file, text }) }),
      invalidatesTags: (r, e, { jobId }) => (e ? [] : [{ type: 'PublicJob', id: jobId }, 'MyResume'])
    }),
    applyToJob: build.mutation({
      query: ({ jobId, file, text, coverNote, answers, ref }) => ({
        url: `/jobs/${jobId}/apply`, method: 'POST', body: toFormData({ resume: file, text, coverNote, answers, ref })
      }),
      invalidatesTags: (r, e, { jobId }) => (e ? [] : [{ type: 'PublicJob', id: jobId }, 'MyApplications', 'MyResume', 'Workplace'])
    }),

    // ----- Employees: internal jobs and referrals -----
    getWorkplace: build.query({ query: () => '/me/workplace', providesTags: ['Workplace'] }),
    getReferralLink: build.mutation({
      query: jobId => ({ url: `/me/referrals/${jobId}/link`, method: 'POST' }),
      invalidatesTags: (r, e) => (e ? [] : ['Workplace'])
    }),
    inviteReferral: build.mutation({
      query: ({ jobId, ...body }) => ({ url: `/me/referrals/${jobId}/invite`, method: 'POST', body }),
      invalidatesTags: (r, e) => (e ? [] : ['Workplace'])
    }),

    // ----- Notifications (any signed-in user) -----
    getNotifications: build.query({ query: () => '/notifications', providesTags: ['Notifications'] }),
    markNotificationsRead: build.mutation({
      query: ids => ({ url: '/notifications/read', method: 'POST', body: { ids } }),
      async onQueryStarted(ids, { dispatch, queryFulfilled }) {
        // Optimistic: the badge clears instantly.
        const patch = dispatch(publicApi.util.updateQueryData('getNotifications', undefined, draft => {
          draft.notifications.forEach(n => { if (!ids?.length || ids.includes(n.id)) n.read = true; });
          draft.unread = draft.notifications.filter(n => !n.read).length;
        }));
        try {
          const { data } = await queryFulfilled;
          dispatch(publicApi.util.upsertQueryData('getNotifications', undefined, data));
        } catch {
          patch.undo();
        }
      }
    })
  })
});

export const {
  useGetStatsQuery, useGetPlansQuery, useSearchJobsQuery, useGetJobQuery, useGetCompanyPageQuery,
  useGetMyApplicationsQuery, useGetMyResumeQuery, useSaveMyResumeMutation, useCheckFitMutation, useApplyToJobMutation,
  useGetWorkplaceQuery, useGetReferralLinkMutation, useInviteReferralMutation,
  useGetNotificationsQuery, useMarkNotificationsReadMutation
} = publicApi;
