import glob from 'glob'

export const findFiles = (globPattern: string): Promise<string[]> => new Promise((resolve, reject) => {
  glob(globPattern, (err, files) => {
    if (err) {
      reject(err)
    } else {
      resolve(files)
    }
  })
})