import { ApiError, type TherapistApprovalStatus } from './api'

export function approvalLabel(status: TherapistApprovalStatus): string {
  switch (status) {
    case null: return 'لم يُرسل الطلب'
    case 'pending': return 'بانتظار الموافقة'
    case 'approved': return 'تمت الموافقة'
    case 'rejected': return 'مرفوض'
    case 'suspended': return 'معلّق'
  }
}

export const documentFileTypes = 'image/jpeg,image/png,application/pdf'

export function documentFileError(file: File | undefined): string | undefined {
  if (!file || !file.size) return 'يرجى اختيار ملف صالح للرفع.'
  if (file.size > 5 * 1024 * 1024) return 'حجم الملف يتجاوز الحد المسموح به (٥ ميغابايت).'
  if (!documentFileTypes.split(',').includes(file.type)) return 'نوع الملف غير مدعوم. اختر ملف PDF أو JPG أو PNG.'
}

export function documentError(error: unknown, uploading = false): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 0:
      case 408:
        return 'تعذّر الاتصال بالخادم. تحقّق من اتصالك بالإنترنت وحاول مرة أخرى.'
      case 413:
        return 'حجم الملف يتجاوز الحد المسموح به (٥ ميغابايت).'
      case 415:
        return 'نوع الملف غير مدعوم. اختر ملف PDF أو JPG أو PNG.'
      case 422:
        return uploading
          ? 'تعذّر قبول الملف. اختر ملف PDF أو JPG أو PNG لا يتجاوز حجمه ٥ ميغابايت.'
          : 'يرجى التحقق من البيانات المدخلة والمحاولة مرة أخرى.'
      case 429:
        return 'تم إرسال طلبات كثيرة. انتظر قليلًا قبل المحاولة مرة أخرى.'
    }
  }
  return uploading
    ? 'تعذّر رفع الملف. حاول مرة أخرى.'
    : 'تعذّر إكمال الطلب. حاول مرة أخرى.'
}
