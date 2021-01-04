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

interface TemplateVersion extends BaseTemplateVersion {
  subject: string
  html_content: string
  plain_content: string
}

interface TemplateVersionParams {
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

export const setClient = (clientInstance: AxiosInstance) => {
  client = clientInstance
}

const getClient = (): AxiosInstance | never => {
  if (!client) {
    throw new Error('SendGrid client unitinialized')
  }

  return client
}

export const fetchTemplates = async (): Promise<{templates: Template[]}> => {
  if (process.env.NODE_ENV === 'test') return {templates: []}

  const {data} = await getClient().get(`/templates`, {
    params: {generations: TEMPLATE_GENERATION}
  })

  return data
}

export const fetchTemplate = async (
  templateId: Template['id']
): Promise<Template> => {
  const {data} = await getClient().get(`/templates/${templateId}`)
  return data
}

export const createTemplate = async (name: string): Promise<Template> => {
  const {data} = await getClient().post(`/templates`, {
    name,
    generation: TEMPLATE_GENERATION
  })
  return data
}

export const updateTemplate = async (
  templateId: Template['id'],
  name: string
): Promise<Template> => {
  const {data} = await getClient().patch(`/templates/${templateId}`, {name})
  return data
}

export const deleteTemplate = async (templateId: Template['id']) => {
  return await getClient().delete(`/templates/${templateId}`)
}

export const createTemplateVersion = async (
  templateId: Template['id'],
  params: TemplateVersionParams
): Promise<TemplateVersion> => {
  const {data} = await getClient().post(
    `/templates/${templateId}/versions`,
    params
  )
  return data
}

export const activateTemplateVersion = async (
  templateId: Template['id'],
  versionId: TemplateVersion['id']
) => {
  const {
    data
  } = await getClient().patch(
    `/templates/${templateId}/versions/${versionId}`,
    {active: 1}
  )
  return data
}

export const deleteTemplateVersion = async (
  templateId: Template['id'],
  versionId: TemplateVersion['id']
) => {
  const {data} = await getClient().delete(
    `/templates/${templateId}/versions/${versionId}`
  )
  return data
}
