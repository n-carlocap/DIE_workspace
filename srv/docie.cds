service DocumentInfoExt {
    function getDocumentResult() returns String;
    function convertToXml() returns String;
    function uploadDocument() returns String;
    
    action myScheduledJob();
}