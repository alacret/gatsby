import { MESSAGE_TYPES } from "./types"
import { store } from "../../redux"
import { internalActions } from "../../redux/actions"
import { GatsbyWorkerPool } from "../worker/types"

export function initJobsMessaging(workerPool: GatsbyWorkerPool): void {
  workerPool.onMessage((msg, workerId) => {
    if (msg.type === MESSAGE_TYPES.JOB_CREATED) {
      store
        .dispatch(internalActions.createJobV2FromInternalJob(msg.payload))
        .then(result => {
          workerPool.sendMessage(
            {
              type: MESSAGE_TYPES.JOB_COMPLETED,
              payload: {
                id: msg.payload.id,
                result,
              },
            },
            workerId
          )
        })
        .catch(error => {
          workerPool.sendMessage(
            {
              type: MESSAGE_TYPES.JOB_FAILED,
              payload: {
                id: msg.payload.id,
                error: error.message,
              },
            },
            workerId
          )
        })
    }
  })
}
