import { initializeApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, collection, doc, setDoc, updateDoc, arrayUnion, DocumentReference } from "firebase/firestore";
import { DataManager, ExperimentData, TrialData, BaseManagerOptions } from "@jspsych-datamanager/core";

/**
 * Configuration interface for Firebase initialization
 */
export interface FirebaseConfig {
    /** Firebase API key */
    apiKey: string;
    /** Firebase authentication domain */
    authDomain: string;
    /** Firebase project ID */
    projectId: string;
    /** Firebase storage bucket */
    storageBucket: string;
    /** Firebase messaging sender ID */
    messagingSenderId: string;
    /** Firebase app ID */
    appId: string;
}

/**
 * Options specific to FirebaseManager initialization
 */
export interface FirebaseManagerOptions extends BaseManagerOptions {
    /** Name of the Firestore collection to use (default: "experiments") */
    collectionName?: string;
    /** Specific document ID to use (optional) */
    documentId?: string;
}

/**
 * A class to manage Firebase operations for jsPsych experiments
 * 
 * This class extends DataManager to provide Firebase-specific implementation
 * for storing and managing experiment data.
 * 
 * @example
 * ```typescript
 * const firebaseManager = new FirebaseManager(firebaseConfig, {
 *     collectionName: "my-experiments",
 *     metadata: { version: "1.0.0" }
 * });
 * ```
 */
export class FirebaseManager extends DataManager {
    private readonly app: FirebaseApp;
    private readonly db: Firestore;
    private readonly docRef: DocumentReference;
    private numberOfWrites: number = 0;

    /**
     * Creates a new FirebaseManager instance
     * @param firebaseConfig Firebase configuration object
     * @param options Additional options for initialization
     */
    constructor(
        firebaseConfig: FirebaseConfig,
        options: FirebaseManagerOptions = {}
    ) {
        super(options.metadata);
        
        this.app = initializeApp(firebaseConfig);
        this.db = getFirestore(this.app);
        
        const collectionName = options.collectionName || "experiments";
        const documentId = options.documentId || undefined;
        
        this.docRef = documentId 
            ? doc(this.db, collectionName, documentId)
            : doc(collection(this.db, collectionName));
    }

    /**
     * Initializes the experiment document in Firestore
     * @param additionalData Additional data to include in the experiment document
     * @throws {Error} If initialization fails
     */
    public async initializeExperiment(additionalData: Partial<ExperimentData> = {}): Promise<void> {
        const initialData: ExperimentData = {
            ...this.metadata,
            trials: [],
            ...additionalData
        };

        try {
            await setDoc(this.docRef, initialData);
            this.numberOfWrites++;
            console.log("[FirebaseManager] Document successfully created!");
        } catch (error) {
            console.error("[FirebaseManager] Error creating document:", error);
            throw new Error("Failed to initialize experiment document");
        }
    }

    /**
     * Adds a new trial to the experiment document
     * @param trialData The trial data to add
     * @throws {Error} If storing the trial fails
     */
    public async addTrialData(trialData: TrialData): Promise<void> {
        const flattenedData = this.flattenNestedArrays(trialData);

        try {
            await updateDoc(this.docRef, {
                trials: arrayUnion(flattenedData),
            });
            this.numberOfWrites++;
            console.log("[FirebaseManager] Added trial data:", flattenedData);
        } catch (error) {
            console.error("[FirebaseManager] Error storing trial data:", error);
            throw new Error("Failed to store trial data");
        }
    }

    /**
     * Gets the total number of writes to Firestore
     * @returns The number of write operations performed
     */
    public getNumberOfOperations(): number {
        return this.numberOfWrites;
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
                console.error("[FirebaseManager] Error in data update callback:", error);
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
            console.log("[FirebaseManager] Total writes to Firestore:", this.getNumberOfOperations());
        };
    }

    /**
     * Flattens nested arrays in an object to make it Firestore-compatible
     * @param obj The object to flatten
     * @returns A new object with flattened arrays
     */
    private flattenNestedArrays<T extends object>(obj: T): T {
        const result = { ...obj } as T;
        
        for (const key in result) {
            const value = result[key];
            
            if (Array.isArray(value)) {
                (result[key] as any) = value.reduce((acc: Record<number, any>, val: any, i: number) => {
                    acc[i] = val;
                    return acc;
                }, {});
            } else if (typeof value === "object" && value !== null) {
                (result[key] as any) = this.flattenNestedArrays(value);
            }
        }
        
        return result;
    }
}
