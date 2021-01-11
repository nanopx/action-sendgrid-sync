#!/usr/bin/env node

import {writeFileSync} from 'fs'
import path from 'path'
import meow from 'meow'
import chalk from 'chalk'
import {setupClient} from './sendgrid'
import {findTemplates, setup} from './setupHandlebars'
import {sync} from './syncSendgrid'

const log = (message: string, dryRun = false) => {
  // eslint-disable-next-line no-console
  console.log(`${dryRun ? chalk.cyan('[DRY RUN] ') : ''}${message}`)
}

const logError = (message: string) => {
  // eslint-disable-next-line no-console
  console.error(chalk.white.bgRed(' Error: '), chalk.red(message))
  process.exit(1)
}

const cli = meow(
  `
  Usage
    $ sendgrid-sync <templatesDir>

  Options
    --partials-dir, -p  Path to partials directory
    --api-key, -a       SendGrid API key (Recommended to use 'SENDGRID_API_KEY' environment variable)
    --template-prefix   Template name prefixes
    --subject-template  Subject template
    --target, -t        Target template base names (names without the prefix specified with '--template-prefix')
    --preserve-versions Number of versions to preserve per template
    --dry-run           Dry run
    --output-file, -o   Output template mapping json to file

  Examples
    $ SENDGRID_API_KEY=<SENDGRID_API_KEY> sendgrid-sync ./path/to/templates -p ./path/to/templates/partials 
    Sync all templates with SendGrid
  `,
  {
    flags: {
      partialsDir: {
        type: 'string',
        alias: 'p',
        default: ''
      },
      apiKey: {
        type: 'string',
        alias: 'a'
      },
      templatePrefix: {
        type: 'string',
        default: ''
      },
      target: {
        type: 'string',
        alias: 't',
        isMultiple: true
      },
      subjectTemplate: {
        type: 'string',
        default: '{{subject}}'
      },
      preserveVersions: {
        type: 'number',
        default: 2
      },
      dryRun: {
        type: 'boolean',
        default: false
      },
      output: {
        type: 'string',
        alias: 'o',
        default: ''
      },
      help: {
        alias: 'h'
      },
      version: {
        alias: 'v'
      }
    }
  }
)

const {flags, input} = cli

const templatesDir = input[0]
if (!templatesDir) {
  // Exit with help
  cli.showHelp()
}

const {
  partialsDir,
  templatePrefix,
  target = [],
  subjectTemplate,
  preserveVersions,
  dryRun,
  apiKey,
  output
} = flags

// eslint-disable-next-line no-console
console.log(
  `
${chalk.yellow('Templates Directory :')} ${templatesDir}
${chalk.yellow('Partials Directory  :')} ${partialsDir}
${chalk.yellow('Template Prefix     :')} ${templatePrefix}
${chalk.yellow('Target Templates    :')} ${
    target.length ? target.join(', ') : 'ALL'
  }
${chalk.yellow('Subject Template    :')} ${subjectTemplate}
${chalk.yellow('Preserve Versions   :')} ${preserveVersions}
${chalk.yellow('Dry Run             :')} ${dryRun ? 'true' : 'false'}
${chalk.yellow('Output File         :')} ${
    output ? path.resolve(process.cwd(), output) : 'No output'
  }
  `
)

const sgApiKey = process.env.SENDGRID_API_KEY || apiKey
if (!sgApiKey) {
  logError(
    'SendGrid API key is required. Please set `SENDGRID_API_KEY` environment variable or use the `--api-key` flag.'
  )
}

const execSync = async () => {
  setupClient(sgApiKey as string)

  const {compileTemplate, generateChangeset} = await setup(
    templatesDir,
    partialsDir
  )

  const {templates} = await findTemplates(templatesDir, partialsDir)

  const targetPaths = target.map(t => path.resolve(templatesDir, `${t}.hbs`))
  if (targetPaths.length) {
    // Check if all targets exist
    const exists = targetPaths.find(t => !templates.includes(t))
    if (exists) throw new Error(`Cannot find template: ${exists}`)
  }

  const targetTemplates = !targetPaths.length
    ? // Mark all templates as modified (Force-sync all files in CLI)
      templates
    : // Use the specified target templates
      targetPaths

  const changes = generateChangeset({
    modified: targetTemplates
  })

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

  const templateIdMap = await sync(changes, templateMap, {
    templatePrefix,
    subjectTemplate,
    preserveVersions,
    dryRun,
    logger: log
  })

  if (output) {
    writeFileSync(
      path.resolve(process.cwd(), output),
      JSON.stringify(templateIdMap, null, 2)
    )
  }

  log(`\n${chalk.greenBright('SendGrid Sync completed.')}`)
}

const run = async () => {
  try {
    await execSync()
  } catch (e) {
    logError(e.message)
  }
}

run()
