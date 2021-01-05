import * as github from '@actions/github'
import * as core from '@actions/core'
// import {exec} from '@actions/exec'
import {setup, findTemplates} from './setupHandlebars'
import {getTemplateDiffFromCommit} from './getTemplateDiffFromCommit'
import {setupClient} from './sendgrid'
import {sync} from './syncSendgrid'

const SENDGRID_API_KEY: string = core.getInput('sendgridApiKey')
const TEMPLATES_DIR: string = core.getInput('templatesDir')
const PARTIALS_DIR: string = core.getInput('partialsDir')
const TEMPLATE_PREFIX: string = core.getInput('templatePrefix') || ''
const SUBJECT_TEMPLATE: string =
  core.getInput('subjectTemplate') || '{{subject}}'
const PRESERVE_VERSIONS = Number(core.getInput('preserveVersions') || '2')
const DRY_RUN = core.getInput('dryRun') === 'true'
const FORCE_SYNC_ALL = core.getInput('forceSyncAll') === 'true'
const ref = github.context.ref

setupClient(SENDGRID_API_KEY)

async function run(): Promise<void> {
  try {
    if (github.context.eventName !== 'push') {
      core.info('SendGrid Sync currently only works on push events.')
      return
    }

    core.info('Initializing SendGrid sync...')

    if (FORCE_SYNC_ALL) {
      core.info(`[FORCE SYNC] Force sync mode enabled - syncing all templates`)
    }

    if (DRY_RUN) {
      core.info(`[DRY RUN] Dry run mode enabled`)
    }

    const {compileTemplate, generateChangeset} = await setup(
      TEMPLATES_DIR,
      PARTIALS_DIR
    )

    const changes = generateChangeset(
      FORCE_SYNC_ALL
        ? {
            // [Force Sync] Mark all templates as modified
            modified: (await findTemplates(TEMPLATES_DIR, PARTIALS_DIR))
              .templates
          }
        : await getTemplateDiffFromCommit(ref)
    )

    const changedTemplates = [...changes.created, ...changes.updated]
    const templateMap = (
      await Promise.all(
        changedTemplates.map(async tplName =>
          (async () =>
            [tplName, await compileTemplate(tplName)] as [string, string])()
        )
      )
    ).reduce(
      (acc, [name, content]) => ({...acc, [name]: content}),
      {} as {[name: string]: string}
    )

    const templateIdMap = await sync(
      changes,
      templateMap,
      TEMPLATE_PREFIX,
      SUBJECT_TEMPLATE,
      PRESERVE_VERSIONS,
      DRY_RUN
    )

    core.setOutput('sendgridTemplateIdMapping', JSON.stringify(templateIdMap))

    core.info('\nSendGrid sync done!')
  } catch (error) {
    if (process.env.NODE_ENV === 'test') {
      // eslint-disable-next-line no-console
      console.error(error)
    }
    core.setFailed(error.message)
  }
}

run()
