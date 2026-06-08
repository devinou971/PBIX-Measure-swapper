/*
 * PBIX Measure Swapper
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 PBIX Measure Swapper Devinou971
 * See LICENSE file in the project root
 */

const fileInput = document.querySelector("#pbixFile");
const measureToReplace = document.querySelector("#measureToReplace");
const tableToReplace = document.querySelector("#tableToReplace");
const replacementMeasure = document.querySelector("#replacementMeasure");
const replacementTable = document.querySelector("#replacementTable");
const linkPosition = document.querySelector("#linkPosition")
const submitButton = document.querySelector("#submitButton");
const toggleTechDetails = document.querySelector("#toggleTechDetails");
const techDetails = document.querySelector("#techDetails");

submitButton.onclick = replaceMeasure;


function checkArguments(){
    let result = true;
    if(fileInput.files.length == 0){
        document.querySelector("#pbixFileErrorMessage").classList.remove("hidden");
        result = false;
    } else {
        document.querySelector("#pbixFileErrorMessage").classList.add("hidden");
    }

    if(measureToReplace.value === ""){
        document.querySelector("#measureToReplaceErrorMessage").classList.remove("hidden");
        result = false;
    } else {
        document.querySelector("#measureToReplaceErrorMessage").classList.add("hidden");
    }

    if(tableToReplace.value === ""){
        document.querySelector("#tableToReplaceErrorMessage").classList.remove("hidden");
        result = false;
    } else {
        document.querySelector("#tableToReplaceErrorMessage").classList.add("hidden");
    }

    if(replacementMeasure.value === ""){
        document.querySelector("#replacementMeasureErrorMessage").classList.remove("hidden");
        result = false;
    } else {
        document.querySelector("#replacementMeasureErrorMessage").classList.add("hidden");
    }

    if(replacementTable.value === ""){
        document.querySelector("#replacementTableErrorMessage").classList.remove("hidden");
        result = false;
    } else {
        document.querySelector("#replacementTableErrorMessage").classList.add("hidden");
    }
    return result;
}

function toUtf16LE(str) {
  const bytes = [];

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);

    // little-endian
    bytes.push(code & 0xFF);         // low byte
    bytes.push((code >> 8) & 0xFF); // high byte
  }

  return bytes;
}

async function buildDownloadUrl(zipWriter, outputFileName){
    const blobURL = URL.createObjectURL(await zipWriter.close());
    const a = document.createElement("a")
    a.href = blobURL;
    a.download = outputFileName;
    a.innerText = "Download";
    
    for(let child of linkPosition.childNodes){
        linkPosition.removeChild(child)
    }
    
    linkPosition.appendChild(a);
}

async function deleteSecurityBindingsFromContentTypes(contentTypesFile){
    if(contentTypesFile === undefined){
        throw "Error : PBIX Report doesn't contain [Content_Types].xml file"
    }
    const contentTypes = await contentTypesFile.getData(new zip.TextWriter());
    const xmlParser = new DOMParser();
    let newXmlContent;
    try {
        const xmlObject = xmlParser.parseFromString(contentTypes, "text/xml");    
        var secObject = xmlObject.querySelector('[PartName="/SecurityBindings"]')
        if (secObject){
            secObject.remove();
        }
        newXmlContent = '<?xml version="1.0" encoding="utf-8"?>' + new XMLSerializer().serializeToString(xmlObject.documentElement); 
    } catch (error) {
        throw "Error : PBIX file not valid. Could not parse [Content_Types].xml file";
    }
    return newXmlContent
}

function findAllNodesWithPropertyName(node, propertyName){
    let results = [];
    if(typeof(node) == "object" && Object.keys(node).includes(propertyName)){
        results = results.concat([node]);
        return results;
    }
    if(typeof(node) == "object"){
        for(let i of Object.keys(node)){
            const item = node[i];
            if (typeof(item) == "object"){
                results = results.concat(findAllNodesWithPropertyName(item, propertyName));
            }
        }    
    } 
    return results;
}

function findAllPathsToNodesWithPropertyName(node, propertyName, master=""){
    if(node === null){
        return []
    }

    if(typeof(node) == "object" && Object.keys(node).includes(propertyName)){
        return [master];
    }

    let results = [];

    if (typeof(node) == "object"){
        for(let i of Object.keys(node)){
            let item = node[i];
            if(typeof(item) == "object"){
                results = results.concat(findAllPathsToNodesWithPropertyName(item, propertyName, `${master}|${i}`));
            } else if (typeof(item) == "string" && item.length > 0 && (item[0] == "{" || item[0] == "[")){
                try {
                    const newNode = JSON.parse(item);
                    results = results.concat(findAllPathsToNodesWithPropertyName(newNode, propertyName, `${master}|${i}|$`));
                } catch (error) {
                }
            }
            
        }
    }

    return results;
}

function extractTableCodes(nodeList){
    const res = []
    for(let node of nodeList){
        res.push(node["Name"]);
    }
    return res;
}

function findNodeByPropertyValue(nodeList, propertyName, value){
    for(let node of nodeList){
        if(Object.keys(node).includes(propertyName) && node[propertyName] == value){
            return node
        }
    }
}

function buildNewQueryFromStringNode(node, path, measureToReplace, tableToReplace, replacementMeasure, replacementTable){
    const root = JSON.parse(node);
    let n = root;
    const steps = path.split("|");
    for(let step of steps){
        if(typeof(n) == "object"){
            n = n[step];
        }
    }
    const tableNode = findNodeByPropertyValue(n["From"], "Entity", tableToReplace);
    if (tableNode == null){
        return node;
    }

    const measureParents = findAllNodesWithPropertyName(n, "Measure");

    for(const measureParent of measureParents){
        if (measureParent["Measure"]["Property"] == measureToReplace){ 
            let newTableCode = "";
            const replacementTableCode = findNodeByPropertyValue(n["From"], "Entity", replacementTable)
            if(replacementTableCode){
                newTableCode = replacementTableCode["Name"];
            }
            else{
                newTableCode = replacementTable[0].toLowerCase();
                let subId = 0;
                while (extractTableCodes(n["From"]).includes(`${newTableCode}${subId}`)){
                    subId += 1;
                }
                newTableCode = `${newTableCode}${subId}`;
                n["From"].push({"Name": newTableCode, "Entity": replacementTable, "Type":0})
            }
            measureParent["Measure"]["Expression"]["SourceRef"]["Source"] = newTableCode
            measureParent["Measure"]["Property"] = replacementMeasure
            if(Object.keys(measureParent).includes("Name")){ 
                measureParent["Name"] = `${replacementTable}.${replacementMeasure}`
            }
        }
    }
    return JSON.stringify(root);
}

async function modifyLayoutFile(layoutFile){
    if(layoutFile === undefined){
        throw "Error : PBIX file not valid. Could not find the Report/Layout file.";
    }
    const layoutBlobContent = await layoutFile.getData( new zip.BlobWriter());

    const layoutBytes = await layoutBlobContent.bytes();
    const layoutString = new TextDecoder('utf-16le').decode(layoutBytes);
    let layouObject;
    try {
        layouObject = JSON.parse(layoutString);
    } catch (error) {
        throw "PBIX file not valid. Could not parse the Layout File to JSON.";
    }

    const allPathsToFromNodes = findAllPathsToNodesWithPropertyName(layouObject, "From");

    for(const path of allPathsToFromNodes){
        let n = layouObject;
        const pathBeforeSecondParse = path.split("|$|")[0]
        const pathAfterSecondParse = path.split("|$|")[1]
        const steps = pathBeforeSecondParse.split("|")
        steps.shift()
        const lastStep = steps.pop(-1)
        for(let step of steps){
            n = n[step]
        }
        
        if(n[lastStep].includes(measureToReplace.value)){
            n[lastStep] = buildNewQueryFromStringNode(n[lastStep], pathAfterSecondParse, measureToReplace.value, tableToReplace.value, replacementMeasure.value, replacementTable.value)
        }
    }

    let newLayoutContent = JSON.stringify(layouObject);

    newLayoutContent = newLayoutContent.replaceAll(
        `{\\"SourceRef\\":{\\"Entity\\":\\"${tableToReplace.value}\\"}},\\"Property\\":\\"${measureToReplace.value}\\"}}`,
        `{\\"SourceRef\\":{\\"Entity\\":\\"${replacementTable.value}\\"}},\\"Property\\":\\"${replacementMeasure.value}\\"}}`
    );

    newLayoutContent = newLayoutContent.replaceAll(
        `\\"${tableToReplace.value}.${measureToReplace.value}\\"`,
        `\\"${replacementTable.value}.${replacementMeasure.value}\\"`
    );
    newLayoutContent = newLayoutContent.replaceAll(
        `\\"${measureToReplace.value}\\"`,
        `\\"${replacementMeasure.value}\\"`
    );
    
    const newUtf16LayoutContent = toUtf16LE(newLayoutContent);
    let newLayoutBytesContent = new Uint8Array(newUtf16LayoutContent.length);
    for(let byteIndex = 0; byteIndex < newUtf16LayoutContent.length; byteIndex ++){
        newLayoutBytesContent[byteIndex]= parseInt(newUtf16LayoutContent[byteIndex]);
    }

    return newLayoutBytesContent;
}

async function replaceMeasure(){
    if(checkArguments()){
        const zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"), { keepOrder: false });
        
        const file = fileInput.files[0];
        let zipFile;
        let contentFiles;
        try {
            zipFile = new zip.ZipReader(new zip.BlobReader(file));
            contentFiles = await zipFile.getEntries();
        } catch (error) {
            alert("Error : PBIX file not valid. Could unzip the pbix file. Are you sure this is a PowerBI report ?");
            return;
        }

        // Deleting the SecurityBindings
        contentFiles = contentFiles.filter((x) => {return x.filename != "SecurityBindings"})
        
        // Modifying the [Content_Types].xml
        const contentTypesFile = contentFiles.find((x) => {return x.filename == "[Content_Types].xml"})
        let newXmlContent;
        try{
            newXmlContent = await deleteSecurityBindingsFromContentTypes(contentTypesFile);
        } catch(error){
            alert(error);
            return;
        }

        // Modifying the Layout
        const layoutFile = contentFiles.find((x) => {return x.filename == "Report/Layout"});
        let newLayoutBytesContent;
        try {
            newLayoutBytesContent = await modifyLayoutFile(layoutFile)
        } catch (error) {
            alert(error);
            return;
        }

        // Rebuilding the zip file
        // - Adding the new [Content_Types].xml
        zipWriter.add("[Content_Types].xml", new zip.TextReader(newXmlContent));
        // - Adding the new Layout
        zipWriter.add("Report/Layout", new zip.BlobReader(new Blob([newLayoutBytesContent])));
        // - Adding the other files
        contentFiles = contentFiles.filter((x) => {return x.filename != "Report/Layout" && x.filename != "[Content_Types].xml"})
        for(let file of contentFiles){
            const blob =await file.getData(new zip.BlobWriter());
            const fileReader = new zip.BlobReader(blob);
            zipWriter.add(file.filename, fileReader);
        }

        // - Buidling download url
        await buildDownloadUrl(zipWriter, file.name)
    }
}