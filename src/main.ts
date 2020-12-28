import path from 'path'
import * as github from '@actions/github'
import * as core from '@actions/core'
// import {exec} from '@actions/exec'
import {loadPartials} from './partialCompileHandlebars'
import {findFiles} from './findFiles'
import {getDiffFromSha} from './getDiffFromSha'

const sha = github.context.sha
const {owner, repo} = github.context.repo
// const SENDGRID_API_KEY: string = core.getInput('sendgridApiKey')
const templatesDir: string = core.getInput('templatesDir')
const partialsDir: string = core.getInput('partialsDir')

async function run(): Promise<void> {
  try {
    core.debug(templatesDir)
    core.debug(partialsDir)
    core.debug(owner)
    core.debug(repo)
    core.debug(sha)

    if (partialsDir) {
      await loadPartials(partialsDir)
    }

    const {addedFiles, modifiedFiles, deletedFiles} = await getDiffFromSha(sha)

    core.debug(addedFiles.join(', '))
    core.debug(modifiedFiles.join(', '))
    core.debug(deletedFiles.join(', '))

    const templates = await findFiles(
      `${path.resolve(process.cwd(), templatesDir)}/**/*.hbs`
    )

    templates.map(template => {
      core.debug(template)
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
