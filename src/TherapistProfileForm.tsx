import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, type ApiClient } from './api'
import { useMutation } from './api-mutation'
import { profileLabels, profileReviewError, therapistSubmissionPath, type ProfileField, type ReviewedProfile, type TherapistProfileResponse } from './therapist-profile-review'
import { optionName, type TherapistOption, type TherapistOptions } from './therapist-options'

type FieldErrors = Partial<Record<ProfileField, string>>
type TextField = 'full_name' | 'job_title' | 'bio' | 'email' | 'city'

function selectOptions(options: TherapistOption[], selected: string[]) {
  return [...options, ...selected
    .filter((code) => code && !options.some((option) => option.code === code))
    .map((code) => ({ code, name_ar: code }))]
    .map(({ code, name_ar }) => <option key={code} value={code}>{name_ar}</option>)
}

export function TherapistProfileForm({
  api, initial, phone, options, submitLabel, saved, close,
}: {
  api: ApiClient
  initial: ReviewedProfile
  phone: string
  options: TherapistOptions
  submitLabel: string
  saved: (response: TherapistProfileResponse) => void
  close?: () => void
}) {
  const prefix = useId()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [failed, setFailed] = useState(false)
  const mutation = useMutation(api)
  const initialLanguages = [...new Set(initial.languages ?? [])]

  function field(name: ProfileField, control: (props: { id: string; name: ProfileField; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode) {
    const id = prefix + name
    const error = errors[name]
    return (
      <div className="remaining-field">
        <label htmlFor={id}>{profileLabels[name]}</label>
        {control({ id, name, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? id + '-error' : undefined })}
        {error && <span className="remaining-error" id={id + '-error'}>{error}</span>}
      </div>
    )
  }

  function text(name: TextField, type = 'text') {
    return field(name, (props) => name === 'bio'
      ? <textarea {...props} defaultValue={initial[name] ?? ''} required />
      : <input {...props} defaultValue={initial[name] ?? ''} type={type} dir={type === 'email' ? 'ltr' : 'auto'} required />)
  }

  function select(name: 'specialty' | 'country', values: TherapistOption[]) {
    const value = initial[name] ?? ''
    return field(name, (props) => (
      <select {...props} defaultValue={value} required>
        <option value="">اختر {profileLabels[name]}</option>
        {selectOptions(values, [value])}
      </select>
    ))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.pending) return
    const form = new FormData(event.currentTarget)
    const value = (name: ProfileField) => String(form.get(name) ?? '').trim()
    const next: FieldErrors = {}
    const checkLength = (name: TextField, min: number, max: number) => {
      const length = Array.from(value(name)).length
      if (length < min || length > max)
        next[name] = `أدخل ${profileLabels[name]} بطول من ${min} إلى ${max} حرفًا.`
    }
    checkLength('full_name', 2, 255)
    checkLength('job_title', 2, 120)
    checkLength('city', 2, 120)
    checkLength('bio', 20, 2000)
    if (value('email').length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value('email')))
      next.email = 'أدخل عنوان بريد إلكتروني صالحًا.'
    if (!options.specialties.some(({ code }) => code === value('specialty'))) next.specialty = 'اختر تخصصًا من القائمة.'
    if (!options.countries.some(({ code }) => code === value('country'))) next.country = 'اختر بلدًا من القائمة.'
    const languages = form.getAll('languages').map(String)
    if (!languages.length || languages.length > 10 || new Set(languages).size !== languages.length ||
      languages.some((code) => !options.languages.some((item) => item.code === code)))
      next.languages = 'اختر من لغة واحدة إلى عشر لغات مختلفة من القائمة.'
    const years = Number(value('years_of_experience'))
    if (!value('years_of_experience') || !Number.isInteger(years) || years < 0 || years > 60)
      next.years_of_experience = 'أدخل عددًا صحيحًا بين ٠ و٦٠.'
    setErrors(next)
    setFailed(false)
    if (Object.keys(next).length) return

    void mutation.run(
      (signal) => api.mutate<TherapistProfileResponse>(therapistSubmissionPath, {
        full_name: value('full_name'),
        job_title: value('job_title'),
        specialty: value('specialty'),
        bio: value('bio'),
        email: value('email'),
        city: value('city'),
        country: value('country'),
        languages,
        years_of_experience: years,
      }, { signal }),
      saved,
      (error) => {
        setFailed(true)
        if (!(error instanceof ApiError) || error.status !== 422 || error.code === 'no_changes') return
        const fields: FieldErrors = {}
        for (const key of Object.keys(error.fields)) {
          const name = key.split('.')[0]
          if (Object.hasOwn(profileLabels, name))
            fields[name as ProfileField] = name === 'email'
              ? 'تحقّق من البريد الإلكتروني؛ ربما يكون مستخدمًا في حساب آخر.'
              : `تحقّق من حقل ${profileLabels[name as ProfileField]}.`
        }
        setErrors(fields)
      },
    )
  }

  const invalid = Object.keys(errors).length > 0
  return (
    <form className="reviewed-profile-form" lang="ar" dir="rtl" noValidate onSubmit={submit}>
      <fieldset disabled={mutation.pending}>
        <div className="remaining-field-grid">
          {text('full_name')}
          {text('job_title')}
        </div>
        {select('specialty', options.specialties)}
        {text('bio')}
        <div className="remaining-field-grid">
          <label className="remaining-field">
            رقم الجوال
            <input readOnly type="tel" dir="ltr" value={phone} />
          </label>
          {text('email', 'email')}
        </div>
        <fieldset>
          <legend>الموقع</legend>
          <div className="remaining-field-grid">
            {text('city')}
            {select('country', options.countries)}
          </div>
        </fieldset>
        <div className="remaining-field-grid">
          {field('languages', (props) => (
            <select {...props} multiple defaultValue={initialLanguages} required>
              {selectOptions(options.languages, initialLanguages)}
            </select>
          ))}
          {field('years_of_experience', (props) => (
            <input {...props} type="number" min={0} max={60} step={1} defaultValue={initial.years_of_experience ?? ''} required />
          ))}
        </div>
      </fieldset>
      {(invalid || failed) && (
        <p className="remaining-error" role="alert">
          {failed ? profileReviewError(mutation.error) : 'يرجى تصحيح الحقول المشار إليها.'}
        </p>
      )}
      <div className="remaining-form-actions">
        {close && <button className="remaining-cancel" type="button" onClick={close}>إلغاء</button>}
        <button type="submit" className="remaining-primary" disabled={mutation.pending}>
          {mutation.pending ? 'جارٍ الإرسال…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

export function TherapistProfileSummary({ profile, phone, options }: {
  profile: ReviewedProfile
  phone: string
  options: TherapistOptions
}) {
  const labels: Record<ProfileField, string | number | null> = {
    ...profile,
    specialty: profile.specialty && optionName(options.specialties, profile.specialty),
    country: profile.country && optionName(options.countries, profile.country),
    languages: profile.languages?.map((code) => optionName(options.languages, code)).join('، ') ?? null,
  }
  return (
    <dl className="reviewed-profile-summary">
      {Object.entries(profileLabels).map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd dir="auto">{labels[key as ProfileField] ?? 'غير متوفر'}</dd>
        </div>
      ))}
      <div><dt>رقم الجوال</dt><dd dir="auto">{phone}</dd></div>
    </dl>
  )
}
