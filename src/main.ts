import {writeFileSync} from 'fs'
import path from 'path'
import * as github from '@actions/github'
import * as core from '@actions/core'
import {setup, findTemplates, Changeset} from './setupHandlebars'
import {
  getTemplateDiffFromCommit,
  TemplateChanges
} from './getTemplateDiffFromCommit'
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
const OUTPUT_FILE = core.getInput('outputFile') || ''
const ref = github.context.ref

setupClient(SENDGRID_API_KEY)

const logger = (message: string, dryRun = false) => {
  core.info(`${dryRun ? '[DRY RUN] ' : ''}${message}`)
}

const debug = (message: string, dryRun = false) => {
  core.debug(`${dryRun ? '[DRY RUN] ' : ''}${message}`)
}

const debugTemplateCommit = (
  changes: TemplateChanges,
  type: keyof TemplateChanges
) => {
  if (!changes[type].length) return

  debug(`${type[0].toUpperCase()}${type.substring(1, type.length)} templates:`)

  for (const t of changes[type]) {
    debug(`  - ${t}`)
  }
}

const logChangeset = (
  changeset: Changeset,
  type: keyof Changeset,
  dryRun = false
) => {
  if (!changeset[type].length) return

  logger(
    `${type[0].toUpperCase()}${type.substring(
      1,
      type.length
    )} templates detected:`,
    dryRun
  )

  for (const t of changeset[type]) {
    logger(`  - ${t}`, dryRun)
  }
}

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

    const changes = FORCE_SYNC_ALL
      ? ({
          // [Force Sync] Mark all templates as modified
          modified: (await findTemplates(TEMPLATES_DIR, PARTIALS_DIR)).templates
        } as TemplateChanges)
      : await getTemplateDiffFromCommit(ref)

    if (!FORCE_SYNC_ALL) {
      debugTemplateCommit(changes, 'added')
      debugTemplateCommit(changes, 'modified')
      debugTemplateCommit(changes, 'renamed')
      debugTemplateCommit(changes, 'deleted')
    }

    const changeset = generateChangeset(changes)

    logChangeset(changeset, 'created', DRY_RUN)
    logChangeset(changeset, 'updated', DRY_RUN)
    logChangeset(changeset, 'renamed', DRY_RUN)
    logChangeset(changeset, 'deleted', DRY_RUN)

    const changedTemplates = [...changeset.created, ...changeset.updated]
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

    const templateIdMap = await sync(changeset, templateMap, {
      templatePrefix: TEMPLATE_PREFIX,
      subjectTemplate: SUBJECT_TEMPLATE,
      preserveVersions: PRESERVE_VERSIONS,
      dryRun: DRY_RUN,
      logger,
      debugLogger: debug
    })

    if (OUTPUT_FILE) {
      writeFileSync(
        path.resolve(process.cwd(), OUTPUT_FILE),
        JSON.stringify(templateIdMap, null, 2)
      )
    }

    core.setOutput('sendgridTemplateIdMapping', JSON.stringify(templateIdMap))

    core.info('\nSendGrid Sync completed.')
  } catch (error) {
    if (process.env.NODE_ENV === 'test') {
      // eslint-disable-next-line no-console
      console.error(error)
    }
    core.setFailed(error.message)
  }
}

run()
