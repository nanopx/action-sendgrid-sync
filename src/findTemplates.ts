import path from 'path'
import glob from 'glob'

export const findFiles = async (
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
