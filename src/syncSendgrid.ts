import * as core from '@actions/core'
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

const getOutdatedVersions = (
  template: Template,
  preserveVersionCount: number
) => {
  const versions = getTemplateVersionNames(template)
  return versions.slice(0, versions.length + 1 - preserveVersionCount)
}

const log = (message: string, dryRun = false) => {
  core.info(`${dryRun ? '[DRY RUN] ' : ''}${message}`)
}

const createTemplatePrefixer = (prefix: string) => (name: string) =>
  `${prefix}${name}`

const createTemplatePrefixRemover = (prefix: string) => (name: string) =>
  name.replace(new RegExp(`^${prefix}`), '')

export const sync = async (
  {created, updated, deleted, renamed}: Changeset,
  templateMap: {[tplName: string]: string},
  templatePrefix = '',
  subjectTemplate = '{{subject}}',
  preserveVersionCount = 2,
  dryRun = false
): Promise<{[tplName: string]: string}> => {
  const getTemplateName = createTemplatePrefixer(templatePrefix)
  const removeTemplatePrefix = createTemplatePrefixRemover(templatePrefix)

  const {templates} = await fetchTemplates()
  const existingTemplateNames = templates
    .filter(t => t.name.startsWith(templatePrefix))
    .map(t => removeTemplatePrefix(t.name))

  // templates to create
  const createTemplates = [
    ...created.filter(t => !existingTemplateNames.includes(t)),
    ...updated.filter(t => !existingTemplateNames.includes(t))
  ]

  // templates to rename
  const renamedTemplates = [
    ...renamed.filter(({from}) => existingTemplateNames.includes(from))
  ]

  // templates to create new version
  const updateVersionTemplates = [
    ...createTemplates,
    ...updated.filter(t => existingTemplateNames.includes(t))
  ]

  // templates to delete
  const deleteTemplates = [
    ...deleted.filter(t => existingTemplateNames.includes(t))
  ]

  const templateByName = templates.reduce(
    (acc, t) => ({
      ...acc,
      [t.name]: t
    }),
    {} as {[name: string]: Template}
  )

  createTemplates.length && log('Creating templates:', dryRun)

  // create
  const createdResponses = await Promise.all(
    createTemplates.map(async (t, i) => {
      const name = getTemplateName(t)
      log(`  - Creating ${name}`, dryRun)

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

  renamedTemplates.length && log('Renaming templates:', dryRun)

  // rename
  const renamedResponses = await Promise.all(
    renamedTemplates.map(async ({from, to}, i) => {
      const fromName = getTemplateName(from)
      const toName = getTemplateName(to)

      log(`  - Renaming template: ${fromName} ▶ ${toName}`, dryRun)

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
    log('Creating new template versions:', dryRun)

  // create new versions
  await Promise.all(
    updateVersionTemplates.map(async t => {
      const name = getTemplateName(t)
      const targetTemplate = templateByName[t]
      const nextVer = getNextVersion(targetTemplate)

      log(`  - Creating new version for template: ${name} (${nextVer})`, dryRun)

      if (dryRun) {
        return Promise.resolve()
      }

      return targetTemplate
        ? createTemplateVersion(targetTemplate.id, {
            name: nextVer,
            subject: subjectTemplate,
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
      return (
        getOutdatedVersions(targetTemplate, preserveVersionCount).length !== 0
      )
    })
  )

  hasOutdated && log('Deleting old template versions:', dryRun)

  // delete old versions
  await Promise.all(
    updateVersionTemplates.map(async t => {
      const name = getTemplateName(t)
      const targetTemplate = templateByName[t]
      const outdated = getOutdatedVersions(targetTemplate, preserveVersionCount)

      return await Promise.all(
        outdated.map(async v => {
          log(`  - Deleting old version: ${name} (${v})`, dryRun)

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

  // delete
  await Promise.all(
    deleteTemplates.map(async t => {
      const targetTemplate = templateByName[t]

      log(`Deleting template: ${t}`, dryRun)

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
