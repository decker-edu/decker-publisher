declare interface Project {
    name : string;
    directory : string;
    videos: VideoLinkData[];
}

declare interface VideoLinkData {
    filename: string,
    filepath: string
}