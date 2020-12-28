import { promises as fs } from 'fs'
import path from 'path'
import handlebars from 'handlebars'
import { findFiles } from './findFiles'

const hbs = handlebars.create()

// Escape all variables and conditions, so only partials gets compiled
const escapeVariables = (template: string): string => template.replace(/\{\{(?!>)/g, '\\{{')

export const loadPartials = async (dir: string) => {
  const files = await findFiles(`${path.resolve(process.cwd(), dir)}/**/*.hbs`)

  await Promise.all(files.map(async file => {
    const filename = path.basename(file, '.hbs')
    const content = await fs.readFile(file)
    // Escape partial variables before compiling to partial template
    const template = hbs.compile(escapeVariables(`${content}`))

    hbs.registerPartial(filename, template)
  }))
}

export const compileTemplate = async (templatePath: string) => {
  const content = await fs.readFile(templatePath)
  // Escape template variables before compiling to template
  const template = hbs.compile(escapeVariables(`${content}`))
  console.log(template({ title: 'title' }))
}
