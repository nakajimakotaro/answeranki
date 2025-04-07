const SERVER_ID = "ScanSnapWebSDK";
const DEFAULT_PORT = "45537";
const VERSION = "1_0_3";

const CONTINUE_SCAN = {
  NORMAL: 0,
  CONTINUE: 1,
  MANUAL_FEED: 2
} as const;

const CONTINUE_SCAN_RETURN_PATH = {
  NORMAL: 0,
  CONTINUE: 1
} as const;

const MULTI_FEED_CONTROL = {
  DISABLED: 0,
  LENGTH: 1,
  OVERLAP: 2
} as const;

const PAPER_PROTECTION = {
  DISABLED: 0,
  ENABLED: 1
} as const;

const PAPER_SIZE = {
  AUTO: 0,
  A4: 1,
  A5: 2,
  A6: 3,
  B5: 4,
  B6: 5,
  POSTCARD: 6,
  BUSINESS_CARD: 7,
  LETTER: 8,
  LEGAL: 9
} as const;

const SEARCHABLE_LANG = {
  JAPANESE: 0,
  ENGLISH: 1,
  FRENCH: 2,
  GERMAN: 3,
  ITALIAN: 4,
  SPANISH: 5,
  CHINESE_SIMPLIFIED: 6,
  CHINESE_TRADITIONAL: 7,
  KOREAN: 8,
  RUSSIAN: 9,
  PORTUGUESE: 10,
  ARABIC: 11,
  INDONESIAN: 12,
  THAI: 13,
  VIETNAMESE: 14,
  CZECH: 15,
  DANISH: 16,
  DUTCH: 17,
  FINNISH: 18,
  GREEK: 19,
  HUNGARIAN: 20,
  NORWEGIAN: 21,
  POLISH: 22,
  ROMANIAN: 23,
  SWEDISH: 24,
  TURKISH: 25,
  AUTO: 99,
  NONE: 100
} as const;

const FORMAT = {
  PDF: 1,
  JPEG: 2
} as const;

const SEARCHABLE = {
  DISABLED: 0,
  ENABLED: 1
} as const;

const BLANK_PAGE_SKIP = {
  DISABLED: 0,
  ENABLED: 1
} as const;

const COLOR_MODE = {
  AUTO: 1,
  COLOR: 2,
  BLACK_WHITE: 3,
  GRAY: 5
} as const;

const DESKEW = {
  DISABLED: 0,
  ENABLED: 1
} as const;

const REDUCE_BLEED_THROUGH = {
  DISABLED: 0,
  ENABLED: 1
} as const;

const ROTATION = {
  NONE: 0,
  AUTO: 1,
  RIGHT_90_TOP_BOTTOM: 2,
  ROTATE_180_RIGHT_LEFT: 3,
  LEFT_90_TOP_BOTTOM: 4,
  RIGHT_90_RIGHT_LEFT: 5,
  ROTATE_180_TOP_BOTTOM: 6,
  LEFT_90_RIGHT_LEFT: 7
} as const;

const SCAN_MODE = {
  NORMAL: 0,
  AUTO: 1,
  FINE: 2,
  SUPER_FINE: 3,
  AUTO_MODE: 99
} as const;

const SCANNING_SIDE = {
  DUPLEX: 0,
  SIMPLEX: 1
} as const;

const SCAN_TYPE = {
  NORMAL: 0,
  E_DOCUMENT: 1
} as const;

const COMPRESSION = {
  LOW: 1,
  MEDIUM_LOW: 2,
  MEDIUM: 3,
  MEDIUM_HIGH: 4,
  HIGH: 5
} as const;

/**
 * Represents the state of a ScanSnap scanning operation with all configurable settings.
 */
interface ScanState {
  /** Controls whether scanning continues after the current batch. */
  continueScan: typeof CONTINUE_SCAN[keyof typeof CONTINUE_SCAN];

  /** Controls multi-feed detection method. */
  multiFeedControl: typeof MULTI_FEED_CONTROL[keyof typeof MULTI_FEED_CONTROL];

  /** Enables/disables paper jam protection. */
  paperProtection: typeof PAPER_PROTECTION[keyof typeof PAPER_PROTECTION];

  /** Specifies the paper size for scanning. */
  paperSize: typeof PAPER_SIZE[keyof typeof PAPER_SIZE];

  /** Specifies the language for OCR when creating searchable PDFs. */
  searchableLang: typeof SEARCHABLE_LANG[keyof typeof SEARCHABLE_LANG];

  /** Specifies the output file format (PDF or JPEG). */
  format: typeof FORMAT[keyof typeof FORMAT];

  /** Enables/disables searchable PDF creation. */
  searchable: typeof SEARCHABLE[keyof typeof SEARCHABLE];

  /** Enables/disables blank page detection and removal. */
  blankPageSkip: typeof BLANK_PAGE_SKIP[keyof typeof BLANK_PAGE_SKIP];

  /** Specifies the color mode for scanning. */
  colorMode: typeof COLOR_MODE[keyof typeof COLOR_MODE];

  /** Enables/disables automatic document straightening. */
  deskew: typeof DESKEW[keyof typeof DESKEW];

  /** Enables/disables reduction of bleed-through from the reverse side of thin documents. */
  reduceBleedThrough: typeof REDUCE_BLEED_THROUGH[keyof typeof REDUCE_BLEED_THROUGH];

  /** Specifies the rotation to apply to scanned images. */
  rotation: typeof ROTATION[keyof typeof ROTATION];

  /** Specifies the scan resolution mode. */
  scanMode: typeof SCAN_MODE[keyof typeof SCAN_MODE];

  /** Specifies whether to scan one side or both sides of documents. */
  scanningSide: typeof SCANNING_SIDE[keyof typeof SCANNING_SIDE];

  /** Specifies the type of document being scanned. */
  scanType: typeof SCAN_TYPE[keyof typeof SCAN_TYPE];

  /** Specifies the compression level for the output file. */
  compression: typeof COMPRESSION[keyof typeof COMPRESSION];

  /** Controls the return path behavior for continuous scanning. */
  continueScanReturnPath: typeof CONTINUE_SCAN_RETURN_PATH[keyof typeof CONTINUE_SCAN_RETURN_PATH] | null;
}

/**
 * Information about a scanned file.
 */
interface FileInfo {
  /** Unique identifier for the file in the ScanSnap system. */
  fileId: string;
  /** Name of the file including extension. */
  fileName: string;
  /** SHA-256 hash of the file content for integrity verification. */
  fileSha256: string;
  /** Size of the file in bytes. */
  fileSize: number;
}

/**
 * Response data from a session connection request.
 */
interface SessionData {
  /** Server identifier, should match SERVER_ID constant. */
  keyword: string;
  /** Session identifier for authenticated requests. */
  sessionid: string;
  /** Result code, 0 indicates success. */
  code: number;
}

/**
 * Response data from a scan operation.
 */
interface ScanResult {
  /** Result code, 0 indicates success. */
  code: number;
  /** Array of scanned file information. */
  data: Array<{
    /** Sequential ID of the scanned page. */
    id: number;
    /** Unique identifier for the file. */
    fileId: string;
    /** Name of the file including extension. */
    fileName: string;
    /** SHA-256 hash of the file content. */
    fileSha256: string;
    /** Size of the file in bytes. */
    fileSize: number;
  }>;
}

/**
 * Parameters for uploading scanned images to a server.
 */
interface UploadParams {
  /** URL endpoint for uploading individual image files. */
  imageUploadUrl: string;
  /** URL endpoint for uploading the file list report. */
  fileListUploadUrl: string;
  /** Array of file IDs to upload. */
  files: string[];
  /** Optional HTTP headers to include with the upload requests. */
  headers?: Record<string, string>;
  /** Optional additional parameters for each file. */
  fileParams?: Record<string, unknown>[];
  /** Optional prefix to add to filenames when uploading. */
  fileNamePrefix?: string;
}

/**
 * SDK for interacting with ScanSnap scanners via the Web SDK.
 * Provides methods for initializing the connection, scanning documents,
 * and processing the resulting files.
 */
/**
 * Local storage key for saving ScanSnap session data
 */
const SCANSNAP_SESSION_STORAGE_KEY = 'scansnap_session';

/**
 * Interface for session data to be stored locally
 */
interface StoredSessionData {
  port: string;
  sessionId: string;
  scanFilesInfo: Record<string, FileInfo>;
  state: ScanState;
  timestamp: number;
}

class ScanSnapWebSDK {
  #port: string = DEFAULT_PORT;
  #baseUrl: string = this.#getBaseUrl();
  #sessionId: string | null = null;
  #isInitialized: boolean = false;
  #isScanning: boolean = false;
  #scanFilesInfo: Map<string, FileInfo> = new Map();
  #eventListeners: Map<string, (data: unknown) => void> = new Map();

  /** Current scanner state with all configurable settings. */
  state: ScanState;

  /**
   * Creates a new instance of the ScanSnapWebSDK with default settings.
   * Attempts to restore session from local storage if available.
   */
  constructor() {
    this.state = {
      continueScan: CONTINUE_SCAN.NORMAL,
      multiFeedControl: MULTI_FEED_CONTROL.OVERLAP,
      paperProtection: PAPER_PROTECTION.ENABLED,
      paperSize: PAPER_SIZE.AUTO,
      searchableLang: SEARCHABLE_LANG.NONE,
      format: FORMAT.PDF,
      searchable: SEARCHABLE.DISABLED,
      blankPageSkip: BLANK_PAGE_SKIP.ENABLED,
      colorMode: COLOR_MODE.AUTO,
      deskew: DESKEW.DISABLED,
      reduceBleedThrough: REDUCE_BLEED_THROUGH.DISABLED,
      rotation: ROTATION.AUTO,
      scanMode: SCAN_MODE.AUTO_MODE,
      scanningSide: SCANNING_SIDE.DUPLEX,
      scanType: SCAN_TYPE.NORMAL,
      compression: COMPRESSION.MEDIUM,
      continueScanReturnPath: CONTINUE_SCAN_RETURN_PATH.CONTINUE
    };

    this.#restoreSessionFromStorage();
  }

  /**
   * Gets the base URL for the ScanSnap Web SDK server.
   * @returns The base URL for API requests
   */
  #getBaseUrl(): string {
    return `http://localhost:${this.#port}`;
  }

  /**
   * Initializes the connection to the ScanSnap Web SDK server.
   * @returns A promise that resolves to a result code (0 for success)
   */
  async initialize(): Promise<number> {
    this.#isInitialized = true;

    if (this.#sessionId) {
      try {
        const sessionData: SessionData = await this.#getSessionId();
        if (sessionData?.keyword === SERVER_ID && sessionData?.sessionid) {
          this.#sessionId = sessionData.sessionid;
          this.#saveSessionToStorage();
          return sessionData.code;
        }
      } catch (err) {
        console.log("Stored session is no longer valid, requesting new session:", err);
      }
    }

    try {
      const sessionData: SessionData = await this.#getSessionId();
      if (sessionData?.keyword === SERVER_ID && sessionData?.sessionid) {
        this.#sessionId = sessionData.sessionid;
        this.#saveSessionToStorage();
        return sessionData.code;
      }

      const portResult: number = await this.#requestPort();
      this.#isInitialized = portResult === 0;
      if (this.#isInitialized) {
        this.#saveSessionToStorage();
      }
      return portResult;
    } catch (error) {
      this.#isInitialized = false;
      console.error("Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Starts a scanning operation with the current settings.
   * @returns A promise that resolves to a result code (0 for success)
   * @throws Error if the scanner is not initialized or is already scanning
   */
  async scan(): Promise<number> {
    if (!this.#isInitialized) {
      throw new Error("Not initialized");
    }
    if (this.#isScanning) {
      throw new Error("Scanning in progress");
    }

    try {
      this.#isScanning = true;
      const response: number = await this.#requestScan();
      if (response === 0) {
        this.#saveSessionToStorage();
      }
      return response;
    } finally {
      this.#isScanning = false;
    }
  }

  /**
   * Upload scanned images to a server.
   * @param params Upload parameters
   * @returns Object containing upload results and report result
   * @throws Error if no files are specified
   */
  async uploadScanImages({
    imageUploadUrl,
    fileListUploadUrl,
    files,
    headers = {},
    fileParams = [],
    fileNamePrefix = ""
  }: UploadParams): Promise<{
    uploadResults: Array<Record<string, unknown> | null>;
    reportResult: Record<string, unknown>
  }> {
    if (!files?.length) {
      throw new Error("No files specified");
    }

    const cleanPrefix: string = fileNamePrefix
      ?.slice(0, 50)
      .replace(/[^a-zA-Z0-9-]+/g, "") || "";

    const blobs: ArrayBuffer[] = await Promise.all(
      files.map(fileId => this.getBlobData(fileId))
    );

    const uploadPromises = blobs.map(async (blob: ArrayBuffer, index: number) => {
      const fileInfo: FileInfo | undefined = this.#scanFilesInfo.get(files[index]);
      if (!fileInfo) return null;

      const fileName: string = cleanPrefix ?
        `${cleanPrefix}_${fileInfo.fileName}` :
        fileInfo.fileName;

      const type: string = fileName.endsWith('.jpg') ? 'image/jpeg' : 'application/pdf';
      const file: File = new File([blob], fileName, { type });

      const formData: FormData = new FormData();
      formData.append('file', file);
      if (fileParams[index]) {
        formData.append('extradata', JSON.stringify(fileParams[index]));
      }

      const response: Response = await fetch(imageUploadUrl, {
        method: 'POST',
        headers,
        body: formData
      });

      return response.json();
    });

    const uploadResults: Array<Record<string, unknown> | null> = await Promise.all(uploadPromises);
    await this.#uploadLogInfo(JSON.stringify(uploadResults));

    const fileList: Array<FileInfo & {fileName: string}> = files.map((fileId: string, index: number) => {
      const fileInfo = this.#scanFilesInfo.get(fileId)!;
      return {
        ...fileInfo,
        fileName: (uploadResults[index]?.fileName as string) || fileInfo.fileName
      };
    });

    const reportResponse: Response = await fetch(fileListUploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(fileList)
    });

    const reportResult: Record<string, unknown> = await reportResponse.json();
    await this.#uploadLogInfo(JSON.stringify({ ...reportResult, _sskey: "report" }));

    return { uploadResults, reportResult };
  }

  /**
   * Register event listeners for scanner events.
   * @param eventName The event to listen for
   * @param callback Function to call when the event occurs
   */
  on(eventName: 'scanToFile', callback: (fileId: string) => void): void;
  on(eventName: 'scanFinish', callback: (fileIds: string[]) => void): void;
  on(eventName: 'scanToFile' | 'scanFinish', callback: ((fileId: string) => void) | ((fileIds: string[]) => void)): void {
    if (['scanToFile', 'scanFinish'].includes(eventName)) {
      this.#eventListeners.set(eventName, callback as (data: unknown) => void);
    }
  }

  /**
   * Gets the binary data for a scanned file.
   * @param fileId The ID of the file to retrieve
   * @returns A promise that resolves to an ArrayBuffer containing the file data
   */
  async getBlobData(fileId: string): Promise<ArrayBuffer> {
    const response: Response = await fetch(`${this.#baseUrl}/api/scanner/converttoblob/${fileId}`, {
      method: 'GET',
      headers: this.#getAuthHeaders(),
    });
    return response.arrayBuffer();
  }

  /**
   * Gets the Base64-encoded data for a scanned image file.
   * @param fileId The ID of the file to retrieve
   * @returns A promise that resolves to a Base64-encoded string
   * @throws Error if the file ID is invalid or the file is a PDF
   */
  async getBase64Data(fileId: string): Promise<string> {
    const fileInfo: FileInfo | undefined = this.#scanFilesInfo.get(fileId);
    if (!fileInfo) throw new Error("Invalid file ID");
    if (fileInfo.fileName.endsWith('.pdf')) {
      throw new Error("Preview not supported for PDF files");
    }

    const response: Response = await fetch(`${this.#baseUrl}/api/scanner/converttobase64/${fileId}`, {
      method: 'GET',
      headers: this.#getAuthHeaders()
    });
    return response.text();
  }

  /**
   * Attempts to find an available port for the ScanSnap Web SDK server.
   * @returns A promise that resolves to a result code (0 for success)
   */
  async #requestPort(): Promise<number> {
    const ports: string[] = Array.from({ length: 14 }, (_, i) => (Number(DEFAULT_PORT) + i + 1).toString());
    for (const port of ports) {
      this.#port = port;
      this.#baseUrl = this.#getBaseUrl();
      try {
        const res: SessionData = await this.#getSessionId();
        if (res?.keyword === SERVER_ID && res.code === 0) {
          this.#sessionId = res.sessionid;
          return 0;
        }
      } catch {
        continue;
      }
    }
    return -2;
  }

  /**
   * Sends a scan request to the ScanSnap Web SDK server.
   * @returns A promise that resolves to a result code (0 for success)
   * @throws Error if the scan data is invalid
   */
  async #requestScan(): Promise<number> {
    const response: Response = await fetch(`${this.#baseUrl}/api/scanner/startscan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.#getAuthHeaders()
      },
      body: JSON.stringify(this.state)
    });

    const result: ScanResult = await response.json();
    if (!result?.data?.length) throw new Error("Invalid scan data");

    const fileIds: string[] = result.data
      .sort((a, b) => a.id - b.id)
      .map((item, index) => {
        const paddedIndex: string = index.toString().padStart(3, '0');
        const [name, ...rest] = item.fileName.split('.');
        const fileName: string = `${name.split('_')[0]}_${paddedIndex}.${rest.join('.')}`;

        this.#scanFilesInfo.set(item.fileId, {
          fileId: item.fileId,
          fileName,
          fileSha256: item.fileSha256,
          fileSize: item.fileSize
        });

        this.#eventListeners.get('scanToFile')?.(item.fileId);
        return item.fileId;
      });

    this.#eventListeners.get('scanFinish')?.(fileIds);
    return result.code;
  }

  /**
   * Gets a session ID from the ScanSnap Web SDK server.
   * @returns A promise that resolves to a SessionData object
   */
  async #getSessionId(): Promise<SessionData> {
    const response: Response = await fetch(`${this.#baseUrl}/api/scanner/connect/${VERSION}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  }

  /**
   * Uploads log information to the ScanSnap Web SDK server.
   * @param message The log message to upload
   */
  async #uploadLogInfo(message: string): Promise<void> {
    await fetch(`${this.#baseUrl}/api/scanner/uploadloginfo/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        ...this.#getAuthHeaders()
      },
      body: message
    });
  }

  /**
   * Gets the authentication headers for API requests.
   * @returns An object containing the session ID header if available
   */
  #getAuthHeaders(): Record<string, string> {
    return this.#sessionId ? { sessionid: this.#sessionId } : {};
  }

  /**
   * Saves the current session data to local storage.
   * This includes the port, session ID, scan files info, and scanner state.
   * @private
   */
  #saveSessionToStorage(): void {
    if (!this.#sessionId) return;

    try {
      const scanFilesInfoObj: Record<string, FileInfo> = {};
      this.#scanFilesInfo.forEach((value, key) => {
        scanFilesInfoObj[key] = value;
      });

      const sessionData: StoredSessionData = {
        port: this.#port,
        sessionId: this.#sessionId,
        scanFilesInfo: scanFilesInfoObj,
        state: { ...this.state },
        timestamp: Date.now()
      };

      localStorage.setItem(SCANSNAP_SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save ScanSnap session to local storage:', error);
    }
  }

  /**
   * Restores session data from local storage if available.
   * @private
   */
  #restoreSessionFromStorage(): void {
    try {
      const storedData = localStorage.getItem(SCANSNAP_SESSION_STORAGE_KEY);
      if (!storedData) return;

      const sessionData: StoredSessionData = JSON.parse(storedData);

      const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (Date.now() - sessionData.timestamp > SESSION_MAX_AGE) {
        console.log('Stored session is too old, not restoring');
        localStorage.removeItem(SCANSNAP_SESSION_STORAGE_KEY);
        return;
      }

      this.#port = sessionData.port;
      this.#baseUrl = this.#getBaseUrl();
      this.#sessionId = sessionData.sessionId;

      this.#scanFilesInfo = new Map();
      Object.entries(sessionData.scanFilesInfo).forEach(([key, value]) => {
        this.#scanFilesInfo.set(key, value);
      });

      this.state = { ...sessionData.state };

    } catch (error) {
      console.error('Failed to restore ScanSnap session from local storage:', error);
      localStorage.removeItem(SCANSNAP_SESSION_STORAGE_KEY);
    }
  }

  /**
   * Clears the stored session data from local storage.
   */
  clearStoredSession(): void {
    localStorage.removeItem(SCANSNAP_SESSION_STORAGE_KEY);
  }

  /**
   * Cleans up resources and disconnects from the ScanSnap Web SDK server.
   * Optionally preserves the session in local storage.
   * @param preserveSession If true, keeps the session data in local storage
   */
  cleanup(preserveSession: boolean = true): void {
    if (this.#sessionId) {
      navigator.sendBeacon(`${this.#baseUrl}/api/scanner/disconnect/${this.#sessionId}`);

      if (!preserveSession) {
        this.clearStoredSession();
        this.#sessionId = null;
      }
    }
  }
}

const scansnap = new ScanSnapWebSDK();
window.addEventListener('pagehide', () => scansnap.cleanup());

export {
  CONTINUE_SCAN,
  CONTINUE_SCAN_RETURN_PATH,
  MULTI_FEED_CONTROL,
  PAPER_PROTECTION,
  PAPER_SIZE,
  SEARCHABLE_LANG,
  FORMAT,
  SEARCHABLE,
  BLANK_PAGE_SKIP,
  COLOR_MODE,
  DESKEW,
  REDUCE_BLEED_THROUGH,
  ROTATION,
  SCAN_MODE,
  SCANNING_SIDE,
  SCAN_TYPE,
  COMPRESSION
};

export default scansnap;
