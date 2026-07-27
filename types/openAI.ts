import { Categories } from '../enums/categories.js'
import { ExperienceLevel } from '../enums/experienceLevel.js'

export interface IOpenAI {
    modelCategory: Categories
    modelName: string
    modelSize: {
        height: number
        width: number
    }
    experienceLevel: ExperienceLevel
}
