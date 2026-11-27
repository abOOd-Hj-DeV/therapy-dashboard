import type { ReviewedProfile, TherapistProfileReview } from '../src/therapist-profile-review'

export const validProfile = {
  full_name: 'Real Professional Name',
  job_title: 'معالج نفسي معتمد',
  specialty: 'general',
  bio: 'نبذة مهنية للمعالج النفسي المعتمد.',
  email: 'therapist@example.test',
  city: 'عمان',
  country: 'JO',
  languages: ['ar', 'en'],
  years_of_experience: 0,
} satisfies ReviewedProfile

export function profileReview(overrides: Partial<TherapistProfileReview> = {}): TherapistProfileReview {
  return {
    approval_status: 'approved',
    application_ref: 'TEST-1',
    account: { whatsapp_number: '+12025550107', email: validProfile.email },
    published: validProfile,
    pending_revision: null,
    last_review: null,
    ...overrides,
  }
}
