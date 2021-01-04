import * as github from '@actions/github'
import * as core from '@actions/core'
// import {exec} from '@actions/exec'
import {setup} from './setupHandlebars'
import {getTemplateDiffFromCommit} from './getTemplateDiffFromCommit'
import {setupClient} from './sendgrid'
import {sync} from './syncSendgrid'

const sha = github.context.sha
// const {owner, repo} = github.context.repo
const SENDGRID_API_KEY: string = core.getInput('sendgridApiKey')
const TEMPLATES_DIR: string = core.getInput('templatesDir')
const PARTIALS_DIR: string = core.getInput('partialsDir')
const PRESERVE_VERSIONS = Number(core.getInput('preserveVersions') || '2')
const DRY_RUN = core.getInput('dryRun') === 'true'

setupClient(SENDGRID_API_KEY)

async function run(): Promise<void> {
  try {
    core.info('Initializing SendGrid sync...')

    if (DRY_RUN) {
      core.info(`[DRY RUN] Dry run mode enabled`)
    }

    const {compileTemplate, generateChangeset} = await setup(
      TEMPLATES_DIR,
      PARTIALS_DIR
    )

    const templateDiff = await getTemplateDiffFromCommit(sha)
    const changes = generateChangeset(templateDiff)

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

    await sync(changes, templateMap, PRESERVE_VERSIONS, DRY_RUN)

    core.info('\nSendGrid sync done!')
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
