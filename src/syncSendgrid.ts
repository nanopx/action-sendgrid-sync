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

export const sync = async (
  {created, updated, deleted, renamed}: Changeset,
  templateMap: {[tplName: string]: string},
  preserveVersionCount = 2,
  dryRun = false
) => {
  const {templates} = await fetchTemplates()
  const existingTemplateNames = templates.map(t => t.name)

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
    createTemplates.map(async t => {
      log(`  - Creating ${t}`, dryRun)

      if (dryRun) {
        return Promise.resolve(({
          id: t,
          name: t,
          versions: []
        } as unknown) as Template)
      }

      return await createTemplate(t)
    })
  )

  renamedTemplates.length && log('Renaming templates:', dryRun)

  // rename
  const renamedResponses = await Promise.all(
    renamedTemplates.map(async ({from, to}) => {
      log(`  - Renaming template: ${from} ▶ ${to}`, dryRun)

      const targetTemplate = templateByName[from]

      if (dryRun) {
        return Promise.resolve(({
          id: to,
          name: to,
          versions: []
        } as unknown) as Template)
      }

      return await updateTemplate(targetTemplate.id, to)
    })
  )

  // update templates index
  for (const t of [...createdResponses, ...renamedResponses]) {
    if (t) {
      templateByName[t.name] = t
    }
  }

  updateVersionTemplates.length &&
    log('Creating new template versions:', dryRun)

  // create new versions
  await Promise.all(
    updateVersionTemplates.map(async t => {
      const targetTemplate = templateByName[t]
      const nextVer = getNextVersion(targetTemplate)

      log(`  - Creating new version for template: ${t} (${nextVer})`, dryRun)

      if (dryRun) {
        return Promise.resolve()
      }

      return targetTemplate
        ? createTemplateVersion(targetTemplate.id, {
            name: nextVer,
            subject: nextVer,
            active: 1,
            html_content: templateMap[t],
            plain_content: ''
          })
        : Promise.resolve()
    })
  )

  updateVersionTemplates.length &&
    log('Deleting old template versions:', dryRun)

  // delete old versions
  await Promise.all(
    updateVersionTemplates.map(async t => {
      const targetTemplate = templateByName[t]
      const outdated = getOutdatedVersions(targetTemplate, preserveVersionCount)

      return await Promise.all(
        outdated.map(async v => {
          log(`  - Deleting old version: ${t} (${v})`, dryRun)

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
}
