import { cloudinary, cloudinaryConfigured } from '../config/cloudinary.config.js';

export { cloudinaryConfigured };

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
}

/** Stores a resume privately (only reachable through signed, expiring URLs). */
export async function uploadResume(file) {
  if (!file || !cloudinaryConfigured) {
    return null;
  }
  const result = await uploadBuffer(file.buffer, {
    folder: 'resumely/resumes',
    resource_type: 'raw',
    type: 'private',
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    context: { original_name: file.originalname }
  });
  return { publicId: result.public_id, url: result.secure_url, resourceType: result.resource_type };
}

/** Stores a company logo publicly (logos appear on public job pages). Returns { url, publicId }. */
export async function uploadCompanyLogo(buffer, companyId) {
  const result = await uploadBuffer(buffer, {
    folder: 'resumely/logos',
    resource_type: 'image',
    public_id: `company_${companyId}_${Date.now()}`,
    overwrite: false
  });
  return { url: result.secure_url, publicId: result.public_id };
}

/** Best-effort delete; a leftover file must never fail the user's action. */
export async function deleteAsset(publicId, resourceType = 'image') {
  if (!publicId || !cloudinaryConfigured) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
  } catch (error) {
    console.error(`Could not delete Cloudinary asset ${publicId}:`, error.message);
  }
}
