import * as github from '@actions/github'
import * as core from '@actions/core'
// import {exec} from '@actions/exec'
import {loadPartials} from './partialCompileHandlebars'
import {findTemplates} from './findTemplates'
import {getDiffFromCommit} from './getTemplateDiffFromCommit'

const sha = github.context.sha
const {owner, repo} = github.context.repo
// const SENDGRID_API_KEY: string = core.getInput('sendgridApiKey')
const templatesDir: string = core.getInput('templatesDir')
const partialsDir: string = core.getInput('partialsDir')

async function run(): Promise<void> {
  try {
    core.debug(templatesDir)
    core.debug(owner)
    core.debug(repo)
    core.debug(sha)

    const {templates, partials} = await findTemplates(templatesDir, partialsDir)

    partials.map(template => {
      core.debug(template)
    })

    templates.map(template => {
      core.debug(template)
    })

    const {addedFiles, modifiedFiles, deletedFiles} = await getDiffFromCommit(
      sha
    )

    addedFiles.map(template => {
      core.debug(template)
    })
    modifiedFiles.map(template => {
      core.debug(template)
    })
    deletedFiles.map(template => {
      core.debug(template)
    })

    loadPartials(partials)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
