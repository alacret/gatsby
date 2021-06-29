import { RootDatabase, open } from "lmdb-store"
// import { performance } from "perf_hooks"
import { ActionsUnion, IGatsbyNode } from "../../redux/types"
import { updateNodes } from "./updates/nodes"
import { updateNodesByType } from "./updates/nodes-by-type"
import {
  IDataStore,
  IGatsbyIterable,
  ILmdbDatabases,
  IQueryResult,
  IRunQueryArgs,
} from "../types"
import { emitter, replaceReducer } from "../../redux"
import { doRunQuery } from "./query/run-query"

const lmdbDatastore = {
  getNode,
  getTypes,
  countNodes,
  iterateNodes,
  iterateNodesByType,
  runQuery,
  ready,

  // deprecated:
  getNodes,
  getNodesByType,
}

const rootDbFile =
  process.env.NODE_ENV === `test`
    ? `test-datastore-${
        process.env.FORCE_TEST_DATABASE_ID ?? process.env.JEST_WORKER_ID
      }`
    : `datastore`

let rootDb
let databases

function getRootDb(): RootDatabase {
  if (!rootDb) {
    rootDb = open({
      name: `root`,
      path: process.cwd() + `/.cache/data/` + rootDbFile,
      compression: true,
    })
  }
  return rootDb
}

function getDatabases(): ILmdbDatabases {
  if (!databases) {
    const rootDb = getRootDb()
    databases = {
      nodes: rootDb.openDB({
        name: `nodes`,
        // FIXME: sharedStructuresKey breaks tests - probably need some cleanup for it on DELETE_CACHE
        // sharedStructuresKey: Symbol.for(`structures`),
        // @ts-ignore
        cache: true,
      }),
      nodesByType: rootDb.openDB({
        name: `nodesByType`,
        dupSort: true,
      }),
      metadata: rootDb.openDB({
        name: `metadata`,
        useVersions: true,
      }),
      indexes: rootDb.openDB({
        name: `indexes`,
        // TODO: use dupSort instead
        // dupSort: true
      }),
    }
  }
  return databases
}

/**
 * @deprecated
 */
function getNodes(): Array<IGatsbyNode> {
  // const start = performance.now()
  const result = Array.from<IGatsbyNode>(iterateNodes())
  // const timeTotal = performance.now() - start
  // console.warn(
  //   `getNodes() is deprecated, use iterateNodes() instead; ` +
  //     `array length: ${result.length}; time(ms): ${timeTotal}`
  // )
  return result ?? []
}

/**
 * @deprecated
 */
function getNodesByType(type: string): Array<IGatsbyNode> {
  // const start = performance.now()
  const result = Array.from<IGatsbyNode>(iterateNodesByType(type))
  // const timeTotal = performance.now() - start
  // console.warn(
  //   `getNodesByType() is deprecated, use iterateNodesByType() instead; ` +
  //     `array length: ${result.length}; time(ms): ${timeTotal}`
  // )
  return result ?? []
}

function iterateNodes(): IGatsbyIterable<IGatsbyNode> {
  // Additionally fetching items by id to leverage lmdb-store cache
  const nodesDb = getDatabases().nodes
  return nodesDb
    .getKeys({ snapshot: false })
    .map(nodeId => (typeof nodeId === `string` ? getNode(nodeId) : undefined)!)
    .filter(Boolean)
}

function iterateNodesByType(type: string): IGatsbyIterable<IGatsbyNode> {
  const nodesByType = getDatabases().nodesByType
  return nodesByType
    .getValues(type)
    .map(nodeId => getNode(nodeId)!)
    .filter(Boolean)
}

function getNode(id: string): IGatsbyNode | undefined {
  if (!id) return undefined
  const { nodes } = getDatabases()
  return nodes.get(id)
}

function getTypes(): Array<string> {
  return getDatabases().nodesByType.getKeys({}).asArray
}

function countNodes(typeName?: string): number {
  if (!typeName) {
    const stats = getDatabases().nodes.getStats()
    // @ts-ignore
    return Number(stats.entryCount || 0) // FIXME: add -1 when restoring shared structures key
  }
  // TODO: change implementation when this issue is addressed: https://github.com/DoctorEvidence/lmdb-store/issues/66
  const { nodesByType } = getDatabases()
  return nodesByType.getValuesCount(typeName)
}

async function runQuery(args: IRunQueryArgs): Promise<IQueryResult> {
  return await doRunQuery({
    datastore: lmdbDatastore,
    databases: getDatabases(),
    ...args,
  })
}

let lastOperationPromise: Promise<any> = Promise.resolve()

function updateDataStore(action: ActionsUnion): void {
  switch (action.type) {
    case `DELETE_CACHE`: {
      const dbs = getDatabases()
      // Force sync commit
      dbs.nodes.transactionSync(() => {
        dbs.nodes.clear()
        dbs.nodesByType.clear()
        dbs.metadata.clear()
        dbs.indexes.clear()
      })
      break
    }
    case `CREATE_NODE`:
    case `ADD_FIELD_TO_NODE`:
    case `ADD_CHILD_NODE_TO_PARENT_NODE`:
    case `DELETE_NODE`: {
      const dbs = getDatabases()
      lastOperationPromise = Promise.all([
        updateNodes(dbs.nodes, action),
        updateNodesByType(dbs.nodesByType, action),
      ])
    }
  }
}

/**
 * Resolves when all the data is synced
 */
async function ready(): Promise<void> {
  await lastOperationPromise
}

export function setupLmdbStore(): IDataStore {
  replaceReducer({
    nodes: (state = new Map(), action) =>
      action.type === `DELETE_CACHE` ? new Map() : state,
    nodesByType: (state = new Map(), action) =>
      action.type === `DELETE_CACHE` ? new Map() : state,
  })
  emitter.on(`*`, action => {
    if (action) {
      updateDataStore(action)
    }
  })
  return lmdbDatastore
}
