import type { ApiClient } from './api'
import { useApiResource } from './api-hooks'

export type TherapistOption = { code: string; name_ar: string }
export type TherapistOptions = {
  countries: TherapistOption[]
  languages: TherapistOption[]
  specialties: TherapistOption[]
}

function options(entries: Record<string, string>): TherapistOption[] {
  return Object.entries(entries).map(([code, name_ar]) => ({ code, name_ar }))
}

const fallback: TherapistOptions = {
  countries: options({
    SY: 'سوريا', JO: 'الأردن', AE: 'الإمارات', BH: 'البحرين', TN: 'تونس',
    DZ: 'الجزائر', DJ: 'جيبوتي', SA: 'السعودية', SD: 'السودان', SO: 'الصومال',
    IQ: 'العراق', OM: 'عُمان', PS: 'فلسطين', QA: 'قطر', KM: 'جزر القمر',
    KW: 'الكويت', LB: 'لبنان', LY: 'ليبيا', EG: 'مصر', MA: 'المغرب',
    MR: 'موريتانيا', YE: 'اليمن', TR: 'تركيا', DE: 'ألمانيا',
    GB: 'المملكة المتحدة', US: 'الولايات المتحدة', CA: 'كندا', FR: 'فرنسا',
    SE: 'السويد', NL: 'هولندا',
  }),
  languages: options({
    ar: 'العربية', en: 'الإنجليزية', fr: 'الفرنسية',
    tr: 'التركية', ku: 'الكردية', de: 'الألمانية',
  }),
  specialties: options({
    anxiety: 'القلق',
    depression: 'الاكتئاب',
    trauma: 'الصدمات النفسية واضطراب ما بعد الصدمة',
    couples_family: 'العلاج الزوجي والأسري',
    children_adolescents: 'الأطفال والمراهقون',
    addiction: 'الإدمان',
    ocd: 'الوسواس القهري',
    general: 'الصحة النفسية العامة',
  }),
}

export function useTherapistOptions(api: ApiClient, enabled = true): TherapistOptions {
  const { data } = useApiResource<{ data: TherapistOptions }>(
    api,
    enabled ? '/meta/therapist-options' : null,
  )
  return {
    countries: data?.data?.countries ?? fallback.countries,
    languages: data?.data?.languages ?? fallback.languages,
    specialties: data?.data?.specialties ?? fallback.specialties,
  }
}

export function optionName(options: TherapistOption[], code: string): string {
  return options.find((option) => option.code === code)?.name_ar ?? code
}
