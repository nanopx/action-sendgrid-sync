import {Changeset} from './setupHandlebars'
import {
  createTemplate,
  fetchTemplates,
  updateTemplate,
  createTemplateVersion,
  Template,
  deleteTemplate,
  deleteTemplateVersion
} from './sendgrid'

const getTemplateVersionNames = (template: Template) => {
  return template.versions.map(v => v.name).sort((a, b) => a.localeCompare(b))
}

const getNextVersion = (template: Template | undefined) => {
  if (!template || !template.versions || template.versions.length === 0)
    return 'v1'

  const versionNames = getTemplateVersionNames(template)

  const lastVer = versionNames[versionNames.length - 1]

  return lastVer && lastVer.startsWith('v')
    ? `v${Number(lastVer.split('')[1]) + 1}`
    : 'v1'
}

const getOutdatedVersions = (template: Template, preserveVersions: number) => {
  const versions = getTemplateVersionNames(template)
  return versions.slice(0, versions.length + 1 - preserveVersions)
}

const createTemplatePrefixer = (prefix: string) => (name: string) =>
  `${prefix}${name}`

const createTemplatePrefixRemover = (prefix: string) => (name: string) =>
  name.replace(new RegExp(`^${prefix}`), '')

type Logger = (message: string, dryRun?: boolean) => void

export interface SyncOptions {
  templatePrefix?: string
  subjectTemplate?: string
  preserveVersions?: number
  dryRun?: boolean
  logger?: Logger
  debugLogger?: Logger
}

const defaultLogger = (message: string, dryRun?: boolean) => {
  // eslint-disable-next-line no-console
  console.log(`${dryRun ? '[DRY RUN] ' : ''}${message}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const noopLogger = (..._: any[]) => {}

const logLists = (
  logger: Logger,
  title: string,
  arr: string[],
  dryRun?: boolean
) => {
  logger(title, dryRun)

  for (const i of arr) {
    logger(`  - ${i}`, dryRun)
  }
}

export const sync = async (
  {created, updated, deleted, renamed}: Changeset,
  templateMap: {[tplName: string]: string},
  subjectMap: {[tplName: string]: string},
  {
    templatePrefix = '',
    subjectTemplate = '{{ subject }}',
    preserveVersions = 2,
    dryRun = false,
    logger = defaultLogger,
    debugLogger = noopLogger
  }: SyncOptions = {}
): Promise<{[tplName: string]: string}> => {
  const getTemplateName = createTemplatePrefixer(templatePrefix)
  const removeTemplatePrefix = createTemplatePrefixRemover(templatePrefix)

  const {templates} = await fetchTemplates()

  const existingTemplateNames = templates
    .filter(t => t.name.startsWith(templatePrefix))
    .map(t => removeTemplatePrefix(t.name))

  logLists(debugLogger, 'Existing templates:', existingTemplateNames)

  // templates to create
  const createTemplates = [
    ...created.filter(t => !existingTemplateNames.includes(t)),
    ...updated.filter(t => !existingTemplateNames.includes(t))
  ]

  logLists(debugLogger, 'createTemplates:', createTemplates)

  // templates to rename
  const renamedTemplates = [
    ...renamed.filter(({from}) => existingTemplateNames.includes(from))
  ]

  logLists(
    debugLogger,
    'renamedTemplates:',
    renamedTemplates.map(({from, to}) => `${from} -> ${to}`)
  )

  // templates to create new version
  const updateVersionTemplates = [
    ...createTemplates,
    ...updated.filter(t => existingTemplateNames.includes(t))
  ]

  logLists(debugLogger, 'updateVersionTemplates:', updateVersionTemplates)

  // templates to delete
  const deleteTemplates = [
    ...deleted.filter(t => existingTemplateNames.includes(t))
  ]

  logLists(debugLogger, 'deleteTemplates:', deleteTemplates)

  const templateByName = templates
    .filter(t => t.name.startsWith(templatePrefix))
    .reduce(
      (acc, t) => ({
        ...acc,
        [removeTemplatePrefix(t.name)]: t
      }),
      {} as {[name: string]: Template}
    )

  createTemplates.length && logger('[SendGrid] Creating templates:', dryRun)

  // create
  const createdResponses = await Promise.all(
    createTemplates.map(async (t, i) => {
      const name = getTemplateName(t)
      logger(`  - Creating ${name}`, dryRun)

      if (dryRun) {
        return Promise.resolve(({
          id: `sendgrid-dummy-id-create-${name}-${i + 1}`,
          name,
          versions: []
        } as unknown) as Template)
      }

      return await createTemplate(name)
    })
  )

  renamedTemplates.length && logger('[SendGrid] Renaming templates:', dryRun)

  // rename
  const renamedResponses = await Promise.all(
    renamedTemplates.map(async ({from, to}, i) => {
      const fromName = getTemplateName(from)
      const toName = getTemplateName(to)

      logger(`  - Renaming template: ${fromName} ▶ ${toName}`, dryRun)

      const targetTemplate = templateByName[from]

      if (dryRun) {
        return Promise.resolve(({
          id: `sendgrid-dummy-id-rename-${toName}-${i + 1}`,
          name: toName,
          versions: []
        } as unknown) as Template)
      }

      return await updateTemplate(targetTemplate.id, toName)
    })
  )

  // update templates index
  for (const t of [...createdResponses, ...renamedResponses]) {
    if (t) {
      templateByName[removeTemplatePrefix(t.name)] = t
    }
  }

  // remove old, renamed templates
  for (const {from} of renamedTemplates) {
    delete templateByName[from]
  }

  updateVersionTemplates.length &&
    logger('[SendGrid] Creating new template versions:', dryRun)

  // create new versions
  await Promise.all(
    updateVersionTemplates.map(async t => {
      const name = getTemplateName(t)
      const targetTemplate = templateByName[t]
      const nextVer = getNextVersion(targetTemplate)
      const subject = subjectMap[t] ?? subjectTemplate

      logger(
        `  - Creating new version for template: ${name} (${nextVer})`,
        dryRun
      )

      if (dryRun) {
        return Promise.resolve()
      }

      return targetTemplate
        ? createTemplateVersion(targetTemplate.id, {
            name: nextVer,
            subject,
            active: 1,
            html_content: templateMap[t],
            plain_content: ''
          })
        : Promise.resolve()
    })
  )

  const hasOutdated = Boolean(
    updateVersionTemplates.find(t => {
      const targetTemplate = templateByName[t]
      return getOutdatedVersions(targetTemplate, preserveVersions).length !== 0
    })
  )

  hasOutdated && logger('[SendGrid] Deleting old template versions:', dryRun)

  // delete old versions
  await Promise.all(
    updateVersionTemplates.map(async t => {
      const name = getTemplateName(t)
      const targetTemplate = templateByName[t]
      const outdated = getOutdatedVersions(targetTemplate, preserveVersions)

      return await Promise.all(
        outdated.map(async v => {
          logger(`  - Deleting old version: ${name} (${v})`, dryRun)

          if (dryRun) {
            return Promise.resolve()
          }

          return deleteTemplateVersion(
            targetTemplate.id,
            targetTemplate.versions.find(version => version.name === v)
              ?.id as string
          )
        })
      )
    })
  )

  deleteTemplates.length && logger('[SendGrid] Deleting templates:', dryRun)

  // delete
  await Promise.all(
    deleteTemplates.map(async t => {
      const name = getTemplateName(t)
      const targetTemplate = templateByName[t]

      logger(`  - Deleting template: ${name}`, dryRun)

      if (dryRun) {
        return Promise.resolve()
      }

      return targetTemplate
        ? deleteTemplate(targetTemplate.id)
        : Promise.resolve()
    })
  )

  return Object.keys(templateByName).reduce(
    (acc, tplName) =>
      deleteTemplates.includes(tplName)
        ? acc
        : {
            ...acc,
            [tplName]: templateByName[tplName].id
          },
    {}
  )
}
