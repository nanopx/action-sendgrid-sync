import * as github from '@actions/github'
import * as core from '@actions/core'
// import {exec} from '@actions/exec'
import {setup} from './setupHandlebars'
import {getTemplateDiffFromCommit} from './getTemplateDiffFromCommit'
import {setupClient, fetchTemplates} from './sendgrid'
import {sync} from './syncSendgrid'

const sha = github.context.sha
// const {owner, repo} = github.context.repo
const SENDGRID_API_KEY: string = core.getInput('sendgridApiKey')
const TEMPLATES_DIR: string = core.getInput('templatesDir')
const PARTIALS_DIR: string = core.getInput('partialsDir')

setupClient(SENDGRID_API_KEY)

async function run(): Promise<void> {
  try {
    const {compileTemplate, generateChangeset} = await setup(
      TEMPLATES_DIR,
      PARTIALS_DIR
    )

    const templateDiff = await getTemplateDiffFromCommit(sha)
    const changes = generateChangeset(templateDiff)
    const {templates} = await fetchTemplates()

    sync(templates, changes)
    // compileTemplate
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
