import axios, {AxiosInstance} from 'axios'

const TEMPLATE_GENERATION = 'dynamic'

interface BaseTemplateVersion {
  id: string
  template_id: string
  active: 0 | 1
  name: string
  generate_plain_content: boolean
  updated_at: string
  editor: 'code' | 'design'
  thumbnail_url: string
}

interface TemplateVersion {
  subject: string
  html_content: string
  plain_content: string
}

interface TemplateVersionParams {
  template_id: string
  active: 0 | 1
  name: string
  html_content: string
  plain_content: string
  subject: string
}

export interface Template {
  id: string
  name: string
  generation: 'dynamic' | 'legacy'
  updated_at: string
  versions: BaseTemplateVersion[]
}

let client: AxiosInstance | null

export const setupClient = (apiKey: string): AxiosInstance => {
  client = axios.create({
    baseURL: 'https://api.sendgrid.com/v3',
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  })

  return client
}

const getClient = (): AxiosInstance | never => {
  if (!client) {
    throw new Error('SendGrid client unitinialized')
  }
  return client
}

export const fetchTemplates = async (): Promise<{templates: Template[]}> => {
  const {data} = await getClient().get(`/templates`, {
    params: {generations: TEMPLATE_GENERATION}
  })

  return data
}

export const fetchTemplate = async (templateId: string): Promise<Template> => {
  const {data} = await getClient().get(`/templates/${templateId}`)
  return data
}

export const postTemplateVersion = async (
  templateId: Template['id'],
  params: TemplateVersionParams
): Promise<TemplateVersion> => {
  const {data} = await getClient().post(
    `/templates/${templateId}/versions`,
    params
  )
  return data
}
