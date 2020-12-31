import * as github from '@actions/github'
import * as core from '@actions/core'
// import {exec} from '@actions/exec'
import {setup} from './setupHandlebars'
import {getTemplateDiffFromCommit} from './getTemplateDiffFromCommit'
import {setupClient, fetchTemplates} from './sendgrid'

const sha = github.context.sha
// const {owner, repo} = github.context.repo
const SENDGRID_API_KEY: string = core.getInput('sendgridApiKey')
const TEMPLATES_DIR: string = core.getInput('templatesDir')
const PARTIALS_DIR: string = core.getInput('partialsDir')

setupClient(SENDGRID_API_KEY)

async function run(): Promise<void> {
  try {
    const {
      // templates,
      // partials,
      // templateDeps,
      // partialDeps,
      // compileTemplate,
      generateChangeset
    } = await setup(TEMPLATES_DIR, PARTIALS_DIR)

    const {
      addedFiles,
      modifiedFiles,
      deletedFiles
    } = await getTemplateDiffFromCommit(sha)

    const changes = generateChangeset(addedFiles, modifiedFiles, deletedFiles)

    changes.created.map(template => {
      core.debug(`create Template: ${template}`)
    })

    changes.updated.map(template => {
      core.debug(`update Template: ${template}`)
    })

    changes.deleted.map(template => {
      core.debug(`deleted Template: ${template}`)
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
