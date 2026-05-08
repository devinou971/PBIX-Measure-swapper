# PBIX Measure swapper

This project aims to replace one measure with another within the front-end of PBIX reports. 
For example, if you used the measure `myMeasure1`, and you want to replace it with a new version like `myMeasure2`, then you can just upload your report, says which measure you want to replace, and it will do it. 

The process runs entirely within your browser, no external server involved. Your report never leaves your PC.

## How to use this tool ? 

1. Go the website and upload your report
2. Define the measure you want to replace, and the name of the table where it is stored
3. Define the new measure, and the name of the table where it is stored. 
4. Hit the "Replace Measure" button.

## How does it work ? 

To modify your report, the javascript acts this way : 
- Unzip the pbix file
- Delete the `SecurityBindings` file
- Modify the `[Content_Types].xml` to remove all mentions of the `SecurityBindings` file
- Modify the `Report/Layout` file to replace the old measure with the new
- Rezip the pbix file

If you want, you can do the same thing by hand.

*Why delete the `SecurityBindings` file ?* \
Because it causes PowerBI to think the output file is corrupted. The purpose of this file is still being debated, and only Microsoft truely know it's use. This file is recreated as soon as you make a modification to the report. \
My personnal hypothesis is that it just holds hashes for all the files in the report. 

## Dependencies

This project uses the following open-source library:
- **zip.js** v2.8.26 (BSD-3-Clause License) - For ZIP file manipulation

See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for full license details.

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

You are free to use, modify, and distribute this software, provided you include the original copyright notice and license.

## AI use disclosure

I used the Copilot LLM in this project to create the style of this website, and also make sure I used the proper licencing. The overall logic was done by hand. 