/**
 * Base interface for all data manager options
 */
export interface BaseManagerOptions {
    metadata?: Partial<ExperimentMetadata>;
}

/**
 * Interface for a single trial data point
 */
export interface TrialData {
    /** The type of trial (e.g., 'html-keyboard-response', 'survey-multi-choice') */
    trial_type: string;
    /** The timestamp when the trial was completed */
    trial_completed?: string;
    /** Any additional trial-specific data */
    [key: string]: any;
}

/**
 * Interface for experiment metadata
 */
export interface ExperimentMetadata {
    /** The date when the experiment was started (YYYY-MM-DD) */
    date: string;
    /** The time when the experiment was started (HH:MM:SS) */
    time: string;
    /** The version of the experiment */
    version?: string;
    /** Any additional metadata */
    [key: string]: any;
}

/**
 * Interface for the complete experiment data structure
 */
export interface ExperimentData extends ExperimentMetadata {
    /** Array of all trials conducted in the experiment */
    trials: TrialData[];
}

/**
 * Abstract base class for data management in jsPsych experiments
 * 
 * This class provides a common interface for different data storage solutions
 * (e.g., Firebase, Supabase, LocalStorage) to be used with jsPsych experiments.
 * 
 * @example
 * ```typescript
 * class MyDataManager extends DataManager {
 *     public async initializeExperiment(data: Partial<ExperimentData>): Promise<void> {
 *         // Implementation
 *     }
 *     // ... other abstract methods
 * }
 * ```
 */
export abstract class DataManager {
    /** Protected metadata that can be accessed by child classes */
    protected readonly metadata: ExperimentMetadata;

    /**
     * Creates a new DataManager instance
     * @param metadata Optional metadata to override default values
     */
    constructor(metadata: Partial<ExperimentMetadata> = {}) {
        this.metadata = {
            date: new Date().toISOString().split('T')[0],
            time: new Date().toISOString().split('T')[1].split('.')[0],
            ...metadata
        };
    }

    /**
     * Initializes the experiment data storage
     * @param additionalData Additional data to include in the experiment document
     * @throws {Error} If initialization fails
     */
    public abstract initializeExperiment(additionalData: Partial<ExperimentData>): Promise<void>;

    /**
     * Adds a new trial to the experiment data
     * @param trialData The trial data to add
     * @throws {Error} If adding the trial fails
     */
    public abstract addTrialData(trialData: TrialData): Promise<void>;

    /**
     * Gets the total number of data operations performed
     * @returns The number of operations performed
     */
    public abstract getNumberOfOperations(): number;

    /**
     * Creates a callback function for jsPsych's on_data_update event
     * @returns A function that handles trial data updates
     */
    public abstract createDataUpdateCallback(): (data: TrialData) => TrialData;

    /**
     * Creates a callback function for jsPsych's on_finish event
     * @returns A function that handles experiment completion
     */
    public abstract createFinishCallback(): () => void;

    /**
     * Gets the current experiment metadata
     * @returns The experiment metadata
     */
    public getMetadata(): ExperimentMetadata {
        return { ...this.metadata };
    }
}
