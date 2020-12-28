import axios from 'axios'

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

interface Template {
  id: string
  name: string
  generation: 'dynamic' | 'legacy'
  updated_at: string
  versions: BaseTemplateVersion[]
}

const client = axios.create({
  baseURL: 'https://api.sendgrid.com/v3'
})

export const fetchTemplates = async (): Promise<{templates: Template[]}> => {
  return await client.get(`/templates`, {
    params: {generations: TEMPLATE_GENERATION}
  })
}

export const fetchTemplate = async (templateId: string): Promise<Template> => {
  return await client.get(`/templates/${templateId}`)
}

export const postTemplateVersion = async (
  templateId: Template['id'],
  params: TemplateVersionParams
): Promise<TemplateVersion> => {
  return await client.post(`/templates/${templateId}/versions`, params)
}
