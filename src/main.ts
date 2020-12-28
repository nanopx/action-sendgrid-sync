import path from 'path'
// import * as github from '@actions/github'
import * as core from '@actions/core'
// import {exec} from '@actions/exec'
import {loadPartials} from './partialCompileHandlebars'
import {findFiles} from './findFiles'

// const {} = process.env
// const {owner, repo} = github.context.repo;
// const SENDGRID_API_KEY: string = core.getInput('sendgridApiKey')
const templatesDir: string = core.getInput('templatesDir')
const partialsDir: string = core.getInput('partialsDir')

async function run(): Promise<void> {
  try {
    core.debug(templatesDir)
    core.debug(partialsDir)

    if (partialsDir) {
      await loadPartials(partialsDir)
    }

    const templates = await findFiles(
      `${path.resolve(process.cwd(), templatesDir)}/**/*.hbs`
    )
    templates.map(template => {
      core.debug(template)
    })

    // core.debug(new Date().toTimeString())
    // await wait(parseInt(ms, 10))
    // core.debug(new Date().toTimeString())

    // core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
