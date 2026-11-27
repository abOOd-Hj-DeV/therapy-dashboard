import type { TherapistOption, TherapistOptions } from './therapist-options'

function optionElements(options: TherapistOption[], current: string[]) {
  return [
    ...options,
    ...current
      .filter((code) => code && !options.some((option) => option.code === code))
      .map((code) => ({ code, name_ar: code })),
  ].map(({ code, name_ar }) => <option key={code} value={code}>{name_ar}</option>)
}

export function TherapistOptionFields({
  options,
  specialty = '',
  country = '',
  languages = [],
}: {
  options: TherapistOptions
  specialty?: string
  country?: string
  languages?: string[]
}) {
  return (
    <div dir="rtl" lang="ar">
      <label className="remaining-field">
        التخصص
        <select name="specialty" defaultValue={specialty}>
          <option value="">اختر التخصص</option>
          {optionElements(options.specialties, [specialty])}
        </select>
      </label>
      <label className="remaining-field">
        البلد
        <select name="country" defaultValue={country}>
          <option value="">اختر البلد</option>
          {optionElements(options.countries, [country])}
        </select>
      </label>
      <label className="remaining-field">
        اللغات
        <select name="languages" multiple defaultValue={languages}>
          {optionElements(options.languages, languages)}
        </select>
      </label>
    </div>
  )
}
