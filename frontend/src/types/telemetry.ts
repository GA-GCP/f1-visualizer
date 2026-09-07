// The wire format is defined by the schemas, which validate it at runtime; these
// types are inferred from them so the two cannot drift. Previously the shapes
// were documented here by comment only, and every JSON.parse was cast unchecked.
export type {
    TelemetryPacket,
    LocationPacket,
    LapDataRecord,
} from '../api/schemas';
