const git = require('nodegit')

const diff = async commitSha => {
  const repo = await git.Repository.open(__dirname)
  const commit = await repo.getCommit(commitSha)
  const diffList = await commit.getDiff()
  const patchList = await diffList.reduce(async (acc, d) => {
    const patches = await d.patches()
    return [...acc, ...patches]
  }, [])

  const addedFiles = patchList
    .filter(p => p.isAdded())
    .map(p => p.newFile().path())
  const modifiedFiles = patchList
    .filter(p => p.isModified())
    .map(p => p.newFile().path())
  const deletedFiles = patchList
    .filter(p => p.isDeleted())
    .map(p => p.oldFile().path())

  console.log({addedFiles, modifiedFiles, deletedFiles})
}

diff('ef26051771b839bf19b10a220a1dfe1645a6756f')
