import { findInvalidModelData } from '../services/modelDataAudit.js'
import { db } from '../utils/consts.js'

try {
    const invalidModels = await findInvalidModelData(db)
    console.log(
        JSON.stringify(
            {
                valid: invalidModels.length === 0,
                invalidCount: invalidModels.length,
                invalidModels,
            },
            null,
            2
        )
    )

    if (invalidModels.length > 0) process.exitCode = 1
} finally {
    db.close()
}
