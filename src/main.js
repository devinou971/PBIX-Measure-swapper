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

async function replaceMeasure(){
    if(checkArguments()){
        const zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"), { keepOrder: false });
        const file = fileInput.files[0];
        const zipFile = new zip.ZipReader(new zip.BlobReader(file))
        
        let contentFiles = await zipFile.getEntries();

        // Deleting the SecurityBindings
        contentFiles = contentFiles.filter((x) => {return x.filename != "SecurityBindings"})
        
        // Modifying the [Content_Types].xml
        const contentTypesFile = contentFiles.find((x) => {return x.filename == "[Content_Types].xml"})
        const contentTypes = await contentTypesFile.getData(new zip.TextWriter());
        const xmlParser = new DOMParser();
        const xmlObject = xmlParser.parseFromString(contentTypes, "text/xml");
        var secObject = xmlObject.querySelector('[PartName="/SecurityBindings"]')
        if (secObject){
            secObject.remove();
        }
        const newXmlContent = '<?xml version="1.0" encoding="utf-8"?>' + new XMLSerializer().serializeToString(xmlObject.documentElement); 

        // Modifying the Layout
        const layoutFile = contentFiles.find((x) => {return x.filename.endsWith("Report/Layout")});
        const layoutBlobContent = await layoutFile.getData( new zip.BlobWriter());
        const layoutBytes = await layoutBlobContent.bytes();

        let newLayoutContent = layoutBytes.join(",")
        newLayoutContent = newLayoutContent.replaceAll(
            toUtf16LE(`\\"${measureToReplace.value}\\"`).join(","), 
            toUtf16LE(`\\"${replacementMeasure.value}\\"`).join(",")
        );
        newLayoutContent = newLayoutContent.replaceAll(
            toUtf16LE(`\\"${tableToReplace.value}.${measureToReplace.value}\\"`).join(","), 
            toUtf16LE(`\\"${replacementTable.value}.${replacementMeasure.value}\\"`).join(",")
        );
        newLayoutContent = newLayoutContent.split(",");
        let newLayoutBytesContent = new Uint8Array(newLayoutContent.length);
        for(let byteIndex = 0; byteIndex < newLayoutContent.length; byteIndex ++){
            newLayoutBytesContent[byteIndex]= parseInt(newLayoutContent[byteIndex]);
        }

        // Rebuilding the zip file
        // - Adding the new [Content_Types].xml

        zipWriter.add("[Content_Types].xml", new zip.TextReader(newXmlContent));
        // - Adding the new Layout
        zipWriter.add("Report/Layout", new zip.BlobReader(new Blob([newLayoutBytesContent])));

        // - Adding the other files
        for(let file of contentFiles){
            if(file.filename != "[Content_Types].xml" && file.filename != "Report/Layout"){
                const blob =await file.getData(new zip.BlobWriter());
                const fileReader = new zip.BlobReader(blob);
                zipWriter.add(file.filename, fileReader);
            }
        }

        // - Buidling download url
        const blobURL = URL.createObjectURL(await zipWriter.close());
        const a = document.createElement("a")
        a.href = blobURL;
        a.download = file.name;
        a.innerText = "Download";
        
        for(let child of linkPosition.childNodes){
            linkPosition.removeChild(child)
        }
        
        linkPosition.appendChild(a);
    }
}