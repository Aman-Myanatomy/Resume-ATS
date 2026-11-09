import crypto from 'crypto';
import Company from '../models/company.models.js';
import Job from '../models/job.models.js';
import { httpError, slugify } from '../utils/http.utils.js';
import { cloudinaryConfigured, deleteAsset, uploadCompanyLogo } from './fileStorage.services.js';
import { normalizeEmailDomains } from './workplace.services.js';
import { companyStages } from './pipeline.services.js';

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+', ''];

async function uniqueSlug(name) {
  const base = slugify(name);
  if (!(await Company.exists({ slug: base }))) return base;
  return `${base}-${crypto.randomBytes(2).toString('hex')}`;
}

/** Local logo route, versioned so browsers can cache it forever. */
function localLogoPath(slug, version) {
  return version ? `/api/companies/${slug}/logo?v=${version}` : null;
}

/** The URL clients should use for a company's logo: Cloudinary, local route, or null. */
export function companyLogoUrl(company) {
  if (!company?.logo) return null;
  return company.logo.url || localLogoPath(company.slug, company.logo.version);
}

export function publicCompany(company) {
  return {
    id: company._id,
    name: company.name,
    slug: company.slug,
    website: company.website || '',
    location: company.location || '',
    size: company.size || '',
    about: company.about || '',
    logoUrl: companyLogoUrl(company)
  };
}

/** What the employer sees in Company profile: the public fields plus internal settings. */
export function employerCompany(company) {
  return {
    ...publicCompany(company),
    emailDomains: company.emailDomains || [],
    jobPrefix: company.jobPrefix || '',
    pipelineStages: companyStages(company)
  };
}

// Detect the real image type from the file's first bytes (never trust the filename or browser type).
function sniffImage(buffer) {
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Saves a new logo. With Cloudinary configured it is uploaded there (and the previous Cloudinary
 * logo is deleted); otherwise the bytes are kept in MongoDB. If Cloudinary is configured but the
 * upload fails, the error is reported rather than silently falling back.
 */
export async function setCompanyLogo(companyId, file) {
  if (!file?.buffer?.length) throw httpError(400, 'Choose an image to upload.');
  const mimeType = sniffImage(file.buffer);
  if (!mimeType) throw httpError(400, 'Logo must be a PNG, JPG or WebP image.');
  const company = await Company.findById(companyId);
  if (!company) throw httpError(404, 'Company not found.');

  const version = (company.logo?.version || 0) + 1;
  const previousPublicId = company.logo?.publicId;
  let logo;

  if (cloudinaryConfigured) {
    try {
      const { url, publicId } = await uploadCompanyLogo(file.buffer, companyId);
      logo = { url, publicId, mimeType, version };
    } catch (error) {
      throw httpError(502, `Could not upload the logo to Cloudinary: ${error.message}`);
    }
  } else {
    logo = { url: localLogoPath(company.slug, version), data: file.buffer, mimeType, version };
  }

  // Replacing the whole sub-document also clears stored bytes when moving to Cloudinary.
  await Company.updateOne({ _id: companyId }, { logo });
  await Job.updateMany({ company: companyId }, { companyLogoUrl: logo.url, companyLogoVersion: version });
  if (previousPublicId && previousPublicId !== logo.publicId) await deleteAsset(previousPublicId);

  return { logoUrl: logo.url, storage: logo.publicId ? 'cloudinary' : 'database' };
}

export async function removeCompanyLogo(companyId) {
  const company = await Company.findById(companyId);
  if (!company) throw httpError(404, 'Company not found.');
  const previousPublicId = company.logo?.publicId;
  await Company.updateOne({ _id: companyId }, { logo: { version: 0 } });
  await Job.updateMany({ company: companyId }, { $unset: { companyLogoUrl: 1 }, companyLogoVersion: 0 });
  if (previousPublicId) await deleteAsset(previousPublicId);
  return { logoUrl: null };
}

export async function getCompanyLogo(slug) {
  const company = await Company.findOne({ slug: String(slug).toLowerCase() }).select('+logo.data logo.mimeType logo.url');
  if (company?.logo?.data?.length) return { data: company.logo.data, mimeType: company.logo.mimeType };
  // Logo moved to Cloudinary: old cached links still work.
  if (/^https:\/\//.test(company?.logo?.url || '')) return { redirect: company.logo.url };
  throw httpError(404, 'No logo.');
}

export async function createCompany({ name, ownerId }) {
  const cleanName = String(name).trim().slice(0, 120);
  return Company.create({ name: cleanName, slug: await uniqueSlug(cleanName), owner: ownerId });
}

export async function getCompanyById(companyId) {
  const company = await Company.findById(companyId);
  if (!company) throw httpError(404, 'Company not found.');
  return employerCompany(company);
}

export async function updateCompany(companyId, input = {}) {
  const updates = {};
  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) throw httpError(400, 'Company name cannot be empty.');
    updates.name = name.slice(0, 120);
  }
  if (input.website !== undefined) {
    const website = String(input.website).trim();
    if (website && !/^https?:\/\//i.test(website)) throw httpError(400, 'Website must start with http:// or https://');
    updates.website = website.slice(0, 200);
  }
  if (input.location !== undefined) updates.location = String(input.location).trim().slice(0, 120);
  if (input.about !== undefined) updates.about = String(input.about).trim().slice(0, 4000);
  if (input.size !== undefined) {
    if (!COMPANY_SIZES.includes(input.size)) throw httpError(400, 'Choose a valid company size.');
    updates.size = input.size;
  }
  if (input.emailDomains !== undefined) updates.emailDomains = await normalizeEmailDomains(input.emailDomains, companyId);

  const company = await Company.findByIdAndUpdate(companyId, updates, { new: true, runValidators: true });
  if (!company) throw httpError(404, 'Company not found.');
  if (updates.name) {
    await Job.updateMany({ company: companyId }, { companyName: company.name });
  }
  return employerCompany(company);
}

export async function getPublicCompanyBySlug(slug) {
  const company = await Company.findOne({ slug: String(slug).toLowerCase() });
  if (!company) throw httpError(404, 'Company not found.');
  return publicCompany(company);
}
