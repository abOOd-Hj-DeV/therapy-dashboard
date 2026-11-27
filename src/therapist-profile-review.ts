import { ApiError } from './api'

export const therapistProfilePath = '/therapists/me/profile'
export const therapistSubmissionPath = '/therapists/me/profile-submission'

export const profileLabels = {
  full_name: 'الاسم',
  job_title: 'المسمى الوظيفي',
  specialty: 'التخصص',
  bio: 'النبذة التعريفية',
  email: 'البريد الإلكتروني',
  city: 'المدينة',
  country: 'البلد',
  languages: 'اللغات',
  years_of_experience: 'سنوات الخبرة',
}

export type ProfileField = keyof typeof profileLabels
type SubmittedProfile = Record<Exclude<ProfileField, 'languages' | 'years_of_experience'>, string> & {
  languages: string[]
  years_of_experience: number
}
export type ReviewedProfile = { [K in keyof SubmittedProfile]: SubmittedProfile[K] | null }
type Kind = 'initial' | 'update'
type TherapistLifecycle = 'invited' | 'awaiting_profile' | 'pending_review' | 'needs_changes' | 'approved' | 'update_pending' | 'suspended'
export type ProfileRevision = {
  id: string
  kind: Kind
  status: 'pending' | 'approved' | 'rejected' | 'superseded'
  submitted_at: string
  data: ReviewedProfile
}
export type TherapistProfileReview = {
  approval_status: null | 'pending' | 'approved' | 'rejected' | 'suspended'
  lifecycle_state?: TherapistLifecycle
  application_ref: string | null
  account: { whatsapp_number: string; email: string | null }
  published: ReviewedProfile
  pending_revision: ProfileRevision | null
  last_review: {
    revision_id: string
    kind: Kind
    status: 'approved' | 'rejected'
    note: string | null
    reviewed_at: string
    data?: ReviewedProfile
  } | null
}
export type TherapistProfileResponse = { data: TherapistProfileReview }

export function therapistLifecycle(profile: TherapistProfileReview): TherapistLifecycle {
  const { lifecycle_state: lifecycle, approval_status: approval, pending_revision: pending } = profile
  if (approval === 'suspended' || lifecycle === 'suspended') return 'suspended'
  if (lifecycle === 'invited' || lifecycle === 'awaiting_profile' ||
    lifecycle === 'pending_review' || lifecycle === 'needs_changes') return lifecycle
  if (approval === 'approved')
    return lifecycle === 'update_pending' || pending?.kind === 'update' ? 'update_pending' : 'approved'
  if (approval === 'pending') return 'pending_review'
  if (approval === 'rejected') return 'needs_changes'
  if (approval === null) return 'awaiting_profile'
  return 'suspended'
}

export function profileReviewError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422 && error.code === 'no_changes')
      return 'لا توجد تعديلات على الملف المنشور لإرسالها للمراجعة.'
    if (error.status === 422) return 'يرجى مراجعة الحقول المشار إليها والمحاولة مرة أخرى.'
    if (error.status === 429) return 'تم إرسال طلبات كثيرة. انتظر قليلًا قبل المحاولة مرة أخرى.'
    if (error.status === 0 || error.status === 408)
      return 'تعذّر الاتصال بالخادم. تحقّق من اتصالك بالإنترنت وحاول مرة أخرى.'
  }
  return 'تعذّر إكمال الطلب. حاول مرة أخرى.'
}
