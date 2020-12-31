import git from 'nodegit'

export const getDiffFromCommit = async (
  commitSha: string
): Promise<{
  addedFiles: string[]
  modifiedFiles: string[]
  deletedFiles: string[]
}> => {
  const repo = await git.Repository.open(process.cwd())

  const commit = await repo.getCommit(commitSha)

  const diffList = await commit.getDiff()

  const patchList = (
    await Promise.all(diffList.map(async d => d.patches()))
  ).reduce((acc, p) => [...acc, ...p], [])

  const {addedFiles, modifiedFiles, deletedFiles} = patchList.reduce(
    (acc, p) => {
      const path = p.newFile().path()
      if (!path.endsWith('.hbs')) return acc

      return {
        addedFiles: p.isAdded() ? [...acc.addedFiles, path] : acc.addedFiles,
        modifiedFiles: p.isModified()
          ? [...acc.modifiedFiles, path]
          : acc.modifiedFiles,
        deletedFiles: p.isDeleted()
          ? [...acc.deletedFiles, path]
          : acc.deletedFiles
      }
    },
    {
      addedFiles: [] as string[],
      modifiedFiles: [] as string[],
      deletedFiles: [] as string[]
    }
  )

  return {addedFiles, modifiedFiles, deletedFiles}
}
