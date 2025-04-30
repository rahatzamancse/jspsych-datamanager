import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DataManager, ExperimentData, TrialData, BaseManagerOptions } from "@jspsych-datamanager/core";

/**
 * Configuration interface for Supabase initialization
 */
export interface SupabaseConfig {
    /** Supabase project URL */
    url: string;
    /** Supabase anon/public key */
    anonKey: string;
}

/**
 * Options specific to SupabaseManager initialization
 */
export interface SupabaseManagerOptions extends BaseManagerOptions {
    /** Name of the table to use (default: "experiments") */
    tableName?: string;
    /** Specific row ID to use (optional) */
    rowId?: string;
}

/**
 * A class to manage Supabase operations for jsPsych experiments
 * 
 * This class extends DataManager to provide Supabase-specific implementation
 * for storing and managing experiment data.
 * 
 * @example
 * ```typescript
 * const supabaseManager = new SupabaseManager(supabaseConfig, {
 *     tableName: "my-experiments",
 *     metadata: { version: "1.0.0" }
 * });
 * ```
 * 
 * IMPORTANT: Before using this manager, make sure to:
 * 1. Create the table in your Supabase dashboard
 * 2. Set up Row Level Security (RLS) policies to allow operations:
 *    - Go to Authentication > Policies
 *    - Add a policy for INSERT: "Enable inserts for authenticated users" with USING(true)
 *    - Add a policy for SELECT: "Enable select for authenticated users" with USING(true)
 */
export class SupabaseManager extends DataManager {
    private readonly supabase: SupabaseClient;
    private readonly tableName: string;
    private rowId?: string;
    private numberOfOperations: number = 0;
    private initialized: boolean = false;
    private pendingTrials: TrialData[] = [];

    /**
     * Creates a new SupabaseManager instance
     * @param supabaseConfig Supabase configuration object
     * @param options Additional options for initialization
     */
    constructor(
        supabaseConfig: SupabaseConfig,
        options: SupabaseManagerOptions = {}
    ) {
        super(options.metadata);
        
        this.supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
        this.tableName = options.tableName || "experiments";
        this.rowId = options.rowId;
        
        // If row ID is provided in options, mark as initialized
        if (this.rowId) {
            this.initialized = true;
            console.log(`[SupabaseManager] Using provided row ID: ${this.rowId}`);
        }
    }

    /**
     * Initializes the experiment data in Supabase
     * @param additionalData Additional data to include in the experiment document
     * @throws {Error} If initialization fails
     */
    public async initializeExperiment(additionalData: Partial<ExperimentData> = {}): Promise<void> {
        try {
            // If already initialized with a rowId from constructor, just update the record
            if (this.initialized && this.rowId) {
                console.log(`[SupabaseManager] Updating existing row with ID: ${this.rowId}`);
                const initialData: Partial<ExperimentData> = {
                    ...this.metadata,
                    ...additionalData,
                    updated_at: new Date().toISOString()
                };
                
                const { error } = await this.supabase
                    .from(this.tableName)
                    .update(initialData)
                    .eq('id', this.rowId);
                
                if (error) {
                    this.handleRlsError(error);
                    throw error;
                }
                
                this.numberOfOperations++;
                console.log("[SupabaseManager] Data successfully updated!");
                return;
            }
            
            // Create new record
            const initialData: ExperimentData = {
                ...this.metadata,
                trials: [],
                ...additionalData
            };

            // Insert new row
            const { data, error } = await this.supabase
                .from(this.tableName)
                .insert(initialData)
                .select();
            
            if (error) {
                this.handleRlsError(error);
                throw error;
            }
            
            // Store the row ID for future updates
            if (data && data.length > 0 && data[0].id) {
                this.rowId = data[0].id;
                this.initialized = true;
                console.log(`[SupabaseManager] Row created with ID: ${this.rowId}`);
                
                // Process any pending trials
                if (this.pendingTrials.length > 0) {
                    console.log(`[SupabaseManager] Processing ${this.pendingTrials.length} pending trials...`);
                    const trials = [...this.pendingTrials];
                    this.pendingTrials = [];
                    
                    for (const trial of trials) {
                        await this.addTrialData(trial).catch(e => {
                            console.error("[SupabaseManager] Error processing pending trial:", e);
                        });
                    }
                }
            } else {
                console.error("[SupabaseManager] No row ID returned from insert operation");
                throw new Error("Failed to get row ID from insert operation");
            }
            
            this.numberOfOperations++;
            console.log("[SupabaseManager] Data successfully initialized!");
        } catch (error) {
            console.error("[SupabaseManager] Error initializing data:", error);
            throw new Error("Failed to initialize experiment data: " + (error instanceof Error ? error.message : String(error)));
        }
    }

    /**
     * Adds a new trial to the experiment data
     * @param trialData The trial data to add
     * @throws {Error} If storing the trial fails
     */
    public async addTrialData(trialData: TrialData): Promise<void> {
        // If not initialized yet, store trials for later processing
        if (!this.initialized) {
            console.log("[SupabaseManager] Not initialized yet, storing trial for later processing");
            this.pendingTrials.push(trialData);
            return;
        }
        
        if (!this.rowId) {
            console.log("[SupabaseManager] No row ID available, storing trial for later processing");
            this.pendingTrials.push(trialData);
            this.initialized = false; // Force reinitialization
            await this.initializeExperiment(); // Try to initialize again
            return;
        }
        
        try {
            // Get the current experiment data
            const { data: currentData, error: fetchError } = await this.supabase
                .from(this.tableName)
                .select('trials')
                .eq('id', this.rowId)
                .single();

            if (fetchError) {
                console.error("[SupabaseManager] Error fetching current data:", fetchError);
                this.handleRlsError(fetchError);
                
                // If the row doesn't exist, we need to reinitialize
                if (fetchError.code === 'PGRST116') {
                    console.log("[SupabaseManager] Row not found, attempting to reinitialize...");
                    this.initialized = false;
                    this.rowId = undefined;
                    this.pendingTrials.push(trialData);
                    await this.initializeExperiment();
                    return;
                }
                
                throw fetchError;
            }

            // Add the new trial to the trials array
            const updatedTrials = [...(currentData?.trials || []), trialData];

            // Update the document with the new trials array
            const { error: updateError } = await this.supabase
                .from(this.tableName)
                .update({ 
                    trials: updatedTrials,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.rowId);

            if (updateError) {
                console.error("[SupabaseManager] Error updating data:", updateError);
                this.handleRlsError(updateError);
                throw updateError;
            }

            this.numberOfOperations++;
            console.log("[SupabaseManager] Added trial data:", trialData);
        } catch (error) {
            console.error("[SupabaseManager] Error storing trial data:", error);
            
            // If the error is related to the row not existing, store the trial and try to reinitialize
            if (error instanceof Error && error.message.includes('not found')) {
                console.log("[SupabaseManager] Row not found, attempting to reinitialize...");
                this.initialized = false;
                this.rowId = undefined;
                this.pendingTrials.push(trialData);
                await this.initializeExperiment();
                return;
            }
            
            throw new Error("Failed to store trial data: " + (error instanceof Error ? error.message : String(error)));
        }
    }

    /**
     * Gets the total number of operations performed
     * @returns The number of operations performed
     */
    public getNumberOfOperations(): number {
        return this.numberOfOperations;
    }

    /**
     * Creates a callback function for jsPsych's on_data_update event
     * @returns A function that handles trial data updates
     */
    public createDataUpdateCallback(): (data: TrialData) => TrialData {
        return (data: TrialData) => {
            if (data.no_upload) {
                delete data.no_upload;
                return data;
            }
            
            this.addTrialData(data).catch(error => {
                console.error("[SupabaseManager] Error in data update callback:", error);
            });
            
            return data;
        };
    }

    /**
     * Creates a callback function for jsPsych's on_finish event
     * @returns A function that handles experiment completion
     */
    public createFinishCallback(): () => void {
        return () => {
            console.log("[SupabaseManager] Total operations performed:", this.getNumberOfOperations());
            
            // Report any pending trials that weren't processed
            if (this.pendingTrials.length > 0) {
                console.warn(`[SupabaseManager] Warning: ${this.pendingTrials.length} trials were not processed`);
            }
        };
    }
    
    /**
     * Checks if the manager has been properly initialized
     * @returns True if initialized, false otherwise
     */
    public isInitialized(): boolean {
        return this.initialized && !!this.rowId;
    }
    
    /**
     * Handles RLS policy error by providing helpful information on how to fix it
     * @param error The error object from Supabase
     * @private
     */
    private handleRlsError(error: any): void {
        if (error && error.code === '42501' && error.message.includes('violates row-level security policy')) {
            console.error(`
=================================================================
ROW LEVEL SECURITY POLICY VIOLATION DETECTED

This error occurs because you don't have the proper RLS policies 
set up for your Supabase table "${this.tableName}".

To fix this, follow these steps:
1. Go to your Supabase dashboard
2. Navigate to "Authentication" → "Policies"
3. Find your "${this.tableName}" table
4. Add the following policies:

- For INSERT:
  * Create a new policy named "Enable inserts for all users"
  * Choose "INSERT" for the operation
  * Set USING expression to "true"
  
- For SELECT:
  * Create a new policy named "Enable select for all users"
  * Choose "SELECT" for the operation
  * Set USING expression to "true"

You may also need policies for UPDATE and DELETE operations 
if your application needs to perform these actions.
=================================================================
            `);
        }
    }
} 