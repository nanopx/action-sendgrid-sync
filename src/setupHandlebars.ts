import {promises as fs} from 'fs'
import path from 'path'
import handlebars from 'handlebars'
import glob from 'glob'

const hbs = handlebars.create()

const findFiles = async (
  globPattern: string,
  ignorePattern?: string
): Promise<string[]> =>
  new Promise((resolve, reject) => {
    glob(globPattern, {ignore: ignorePattern}, (err, files) => {
      if (err) {
        reject(err)
      } else {
        resolve(files)
      }
    })
  })

export const findTemplates = async (
  templatesDir: string,
  partialsDir?: string
): Promise<{templates: string[]; partials: string[]}> => {
  const templates = await findFiles(
    `${path.resolve(process.cwd(), templatesDir)}/**/*.hbs`,
    partialsDir
      ? `${path.resolve(process.cwd(), partialsDir)}/**/*.hbs`
      : undefined
  )

  const partials = partialsDir
    ? await findFiles(`${path.resolve(process.cwd(), partialsDir)}/**/*.hbs`)
    : []

  return {
    templates,
    partials
  }
}

// Escape all variables and conditions, so only partials gets compiled
const escapeVariables = (template: string): string =>
  template.replace(/\{\{(?!>)/g, '\\{{')

export const getTemplateName = (templatesDir: string, templatePath: string) => {
  return path.relative(templatesDir, templatePath).replace(/.hbs$/, '')
}

const loadPartials = async (
  partialsDir: string,
  partialFiles: string[]
): Promise<string[]> => {
  return await Promise.all(
    partialFiles.map(async file => {
      const name = getTemplateName(partialsDir, file)
      const content = await fs.readFile(file)
      // Escape partial variables before compiling to partial template
      const template = hbs.compile(escapeVariables(`${content}`))

      hbs.registerPartial(name, template)
      return file
    })
  )
}

type ASTProgram = ReturnType<typeof hbs.parse>

const getTemplateAst = async (templatePath: string): Promise<ASTProgram> => {
  const content = await fs.readFile(templatePath)
  return hbs.parse(escapeVariables(`${content}`))
}

const getTemplatePartialNodes = async (templatePath: string) => {
  const ast = await getTemplateAst(templatePath)
  return ast.body.filter(
    node =>
      node.type === 'PartialStatement' || node.type === 'PartialBlockStatement'
  )
}

export const getTemplatePartialDeps = async (templatePath: string) => {
  const partialNodes = await getTemplatePartialNodes(templatePath)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return partialNodes.map(node => (node as any).name.original)
}

interface DependencyMap {
  [name: string]: string[]
}

interface DependencyMaps {
  templateDeps: DependencyMap
  partialDeps: DependencyMap
}

export const getDependencyMaps = async (
  templatesDir: string,
  templates: string[]
): Promise<DependencyMaps> => {
  const templateDeps: {[tplName: string]: string[]} = await templates.reduce(
    async (acc, tpl) => ({
      ...(await acc),
      [getTemplateName(templatesDir, tpl)]: await getTemplatePartialDeps(tpl)
    }),
    Promise.resolve({})
  )

  const partialDeps = Object.keys(templateDeps).reduce(
    (acc, tpl) =>
      templateDeps[tpl].reduce(
        (v, prt) => ({
          ...v,
          [prt]: v[prt] ? [...v[prt], tpl] : [tpl]
        }),
        acc
      ),
    {} as {[prtName: string]: string[]}
  )

  return {templateDeps, partialDeps}
}

export const createCompileTemplate = (templatesDir: string) => async (
  name: string
): Promise<string> => {
  const content = await fs.readFile(path.resolve(templatesDir, `${name}.hbs`))
  // Escape template variables before compiling to template
  const template = hbs.compile(escapeVariables(`${content}`))
  return template({title: 'title'})
}

export interface Changeset {
  created: string[]
  updated: string[]
  deleted: string[]
  renamed: {from: string; to: string}[]
}

export const createGenerateChangeset = (
  templatesDir: string,
  partialsDir: string | undefined = undefined,
  templates: string[],
  partials: string[],
  {partialDeps}: DependencyMaps
) => ({
  added = [],
  modified = [],
  deleted = [],
  renamed = []
}: {
  added?: string[]
  modified?: string[]
  deleted?: string[]
  renamed?: {from: string; to: string}[]
}): Changeset => {
  const renamedNewFiles = renamed.map(r => r.to)

  const addedTemplates = templates
    .filter(t => added.includes(t))
    .map(t => getTemplateName(templatesDir, t))
  const modifiedTemplates = templates
    .filter(t => modified.includes(t))
    .map(t => getTemplateName(templatesDir, t))
  const deletedTemplates = templates
    .filter(t => deleted.includes(t))
    .map(t => getTemplateName(templatesDir, t))
  const renamedTemplates = renamed.map(({from, to}) => ({
    from: getTemplateName(templatesDir, from),
    to: getTemplateName(templatesDir, to)
  }))

  const addedPartials = partials.filter(t => added.includes(t))
  const modifiedPartials = partials.filter(t => modified.includes(t))
  const deletedPartials = partials.filter(t => deleted.includes(t))
  const renamedPartials = partials.filter(t => renamedNewFiles.includes(t))

  const updatedTemplates = [
    ...new Set([
      ...modifiedTemplates,
      // Update template with added/modified/deleted/renamed partials
      ...(partialsDir
        ? [
            ...addedPartials,
            ...modifiedPartials,
            ...deletedPartials,
            ...renamedPartials
          ].reduce((acc, p) => {
            const name = getTemplateName(partialsDir, p)
            return [...acc, ...partialDeps[name]]
          }, [] as string[])
        : [])
    ])
  ].filter(t => !addedTemplates.includes(t) && !deletedTemplates.includes(t))

  return {
    created: addedTemplates,
    updated: updatedTemplates,
    deleted: deletedTemplates,
    renamed: renamedTemplates
  }
}

export const setup = async (templatesDir: string, partialsDir?: string) => {
  const {templates, partials} = await findTemplates(templatesDir, partialsDir)

  const {templateDeps, partialDeps} = await getDependencyMaps(
    templatesDir,
    templates
  )

  if (partialsDir) {
    await loadPartials(partialsDir, partials)
  }

  return {
    templates,
    partials,
    templateDeps,
    partialDeps,
    compileTemplate: createCompileTemplate(templatesDir),
    generateChangeset: createGenerateChangeset(
      templatesDir,
      partialsDir,
      templates,
      partials,
      {
        templateDeps,
        partialDeps
      }
    )
  }
}
