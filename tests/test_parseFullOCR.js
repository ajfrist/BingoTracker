
// Parse raw string from whole image OCR into 5x5 cell output - backtracking
const parseFullOCR = (raw, cellIndex = 0, latestBColumn=null, debug=false) => {
    
    // Remove Free space & numbers inside of that cell; all new-lines; replace '|', '\\', or '/' with space; remove all text 
    let cleaned = raw.replace(/\n/g, ' ').replace(/\|/g, ' ').replace(/\\/g, ' ').replace(/\//g, ' ').replace(/[^\d\s]/g, '').trim();
    if (debug) {
        debugger;
    }
    if (cleaned.length == 0){ 
        return null; 
        // return Array(25 - cellIndex).fill(-1);
    }

    // Handle free space
    if (cellIndex == 12){ 
        let followingVals = parseFullOCR(cleaned, cellIndex + 1, latestBColumn, debug);

        if (followingVals != null){
            return [0, ...followingVals]; // Good case: found a match, success!
        } 
        else {
            return null;
            // return Array(25 - cellIndex).fill(-2);
        }
    }

    // first column, could be next 1 or 2 characters, must be 1-15
    if (cellIndex % 5 == 0){ // B column
        let currentValInt;
        
        if ((/^(1[0-5])$/.test(cleaned.substring(0, 2)))){ // check for 2 characters width numbers
            currentValInt = Number(cleaned.substring(0, 2));
            if (!isNaN(currentValInt)){
                let followingVals = parseFullOCR(cleaned.substring(2), cellIndex + 1, currentValInt, debug);

                if (followingVals != null){
                    return [currentValInt, ...followingVals]; // Good case: found a match, success!
                } 

                // Verify that not happening to match the previous column B value (scan read same value twice)
                if (latestBColumn == currentValInt){   
                    // skip to next valid value
                    let followingVals = parseFullOCR(cleaned.substring(2), cellIndex, latestBColumn, debug);

                    if (followingVals != null){
                        return followingVals; // Good case: found a match, success!
                    }
                }
            }
        }


        if ((/^([1-9])$/.test(cleaned.substring(0, 1)))){ // check for 1 character width numbers
            currentValInt = Number(cleaned.substring(0, 1));
            if (!isNaN(currentValInt)){
                let followingVals = parseFullOCR(cleaned.substring(1), cellIndex + 1, currentValInt, debug);

                if (followingVals != null){
                    return [currentValInt, ...followingVals]; // Good case: found a match, success!
                } 

                // Verify that not happening to match the previous column B value (scan read same value twice)
                if (latestBColumn == currentValInt){   
                    // skip to next valid value
                    let followingVals = parseFullOCR(cleaned.substring(1), cellIndex, latestBColumn, debug);

                    if (followingVals != null){
                        return followingVals; // Good case: found a match, success!
                    }
                }
            }
        }

        return null; // Exhausted all possibilities at this depth: signal dead-end
        // return Array(25 - cellIndex).fill(-4);
    } 
    else {  // other columns, only 2 characters wide

        // First check double OCR reading from the B column within the same line
        if (latestBColumn != null && cellIndex % 5 == 1){ // If in I column, verify not matching previous B column value (scan read same value twice)
            // skip to next valid value
            if (latestBColumn < 10 && latestBColumn == Number(cleaned.substring(0, 1))){
                let followingVals = parseFullOCR(cleaned.substring(1), cellIndex, latestBColumn, debug);

                if (followingVals != null){
                    return followingVals; // Good case: found a match, success!
                }
            }
            else if (latestBColumn >= 10 && latestBColumn == Number(cleaned.substring(0, 2))){
                let followingVals = parseFullOCR(cleaned.substring(2), cellIndex, latestBColumn, debug);

                if (followingVals != null){
                    return followingVals; // Good case: found a match, success!
                }
            }
        }

        // Check if the next 2 characters would work
        let currentVal = cleaned.substring(0, 2);      
        if ((cellIndex % 5 == 1 && (/^(1[6-9]|2[0-9]|30)$/.test(currentVal))) || //I column
            (cellIndex % 5 == 2 && (/^(3[1-9]|4[0-5])$/.test(currentVal))) ||   // N column
            (cellIndex % 5 == 3 && (/^(4[6-9]|5[0-9]|60)$/.test(currentVal))) || // G column
            (cellIndex % 5 == 4 && (/^(6[1-9]|7[0-5])$/.test(currentVal)))       // O column
        ) { 

            let currentValInt = Number(cleaned.substring(0, 2));
            if (!isNaN(currentValInt)){
                if (cellIndex < 24){
                    let followingVals = parseFullOCR(cleaned.substring(2), cellIndex + 1, latestBColumn, debug);

                    if (followingVals != null){
                        return [currentValInt, ...followingVals]; // Good case: found a match, success!
                    }
                }
                else { 
                    return [currentValInt]; // Bottom-most case; would indicate overall completion & success!
                }
            }
        }

        return null; // Exhausted all possibilities at this depth: signal dead-end
        
        // Return an array of -1s of size of remaining cells = 25-cellIndex
        // return Array(25 - cellIndex).fill(-5); // Signal that we are in a valid path, but cannot be sure of the remaining values (due to scan quality); will be treated as "unknown" in the final board generation
        
        // let followingVals = parseFullOCR(cleaned.substring(1), cellIndex + 1, latestBColumn, debug);
        // if (followingVals != null){
        //     return [Number(cleaned.substring(0, 1)), ...followingVals]; // Good case: found a match, success!
        // }
        // followingVals = parseFullOCR(cleaned.substring(2), cellIndex + 1, latestBColumn, debug);
        // if (followingVals != null){
        //     return [Number(cleaned.substring(0, 2)), ...followingVals]; // Good case: found a match, success!
        // }
        // followingVals = parseFullOCR(cleaned.substring(3), cellIndex + 1, latestBColumn, debug);
        // if (followingVals != null){
        //     return [Number(cleaned.substring(0, 3)), ...followingVals]; // Good case: found a match, success!
        // }
        // followingVals = parseFullOCR(cleaned.substring(4), cellIndex + 1, latestBColumn, debug);
        // if (followingVals != null){
        //     return [Number(cleaned.substring(0, 4)), ...followingVals]; // Good case: found a match, success!
        // }

    
    }
};

const main = () => {
    const testInputs = [
        "1 16 31 46 61\n2 17 32 47 62\n3 18 FREE 48 63\n4 19 34 49 64\n5 20 35 50 65",          // 0 Normal case
        "1|16|31|46|61\n2|17|32|47|62\n3|18|FREE|48|63\n4|19|34|49|64\n5|20|35|50|65",          // 1 Pipes instead of spaces
        "1 16 31 46 61\n2 17 32 47 62\n3 18 FREE 48 63\n4 19 34 49 64\n5 20 35 50",             // 2 Missing last number
        "1 16 31 46 61\n2 17 32 47 62\n3 18 FREE 48 63\n4 19 34 49 64\n5 20 35 50 65\n",        // 3 Extra newline at end
        "1a16b31c46d61\n2e17f32g47h62\n3i18jFREEk48l63\n4m19n34o49p64\n5q20r35s50t65",          // 4 Noise characters
        "116314661\n217324762\n318FREE4863\n419344964\n520355065",                              // 5 No spaces at all
        "122541 51 63 3 30375466 3 7 21 RE 56.74 1 26|35 50 69 10 17 4547 64 w Wikipedia",      // 6 real example 1
        "122541 5163\n3 30/375466 7 21 FREE 5674 1 26 35 50\\69 10 17 4547 64",                 // 7 real example 2 
        "122541 5163\n3 30/375466 7 21 FREE 5674\n1 26 35 50\\69 10 17 4547 64",                // 8 real example 3 

        "BINGO\n7 26 4058 73\n142234 55 68 4 24 FREE\n4672\n9 203652 74 6 2835 49 64",          // 9 real example 4 
        "BINGO B 7 26 405873\n142234 55 68 4 24 FRE 4672 9 203652 74\n6 283549 64",             // 10 real example 5
        "BINGO B\n7 7 26 405873 14223455 68\n4 4 24 FREE 46 72 9 2036\n52 74 9 6 2835 49 64 6", // 11 real example 6
        "BINGO B\n7 7 26 405873 14223455 68\n4 4 24 FREE 46 72 9 2036\n52 74 9 6 2835 49 64",   // 12 real example 6, but without extra char '6' at end
        "BINGO B\n7 26 405873 14223455 68\n4 4 24 FREE 46 72 9 2036\n52 74 9 6 2835 49 64 6",   // 13 real example 6, but without doubled '7'
        "BINGO B\n7 7 26 405873 14223455 68\n4 24 FREE 46 72 9 2036\n52 74 9 6 2835 49 64 6",   // 14 real example 6, but without doubled '4'
        "BINGO B\n7 7 26 405873 14223455 68\n4 4 24 FREE 46 72 9 2036\n52 74 6 2835 49 64 6",   // 15 real example 6, but without doubled '9'
        "BINGO B\n7 7 26 405873 14223455 68\n4 24 FREE 46 72 9 2036\n52 74 6 2835 49 64 6",   // 16 real example 6, but without doubled '9' or '4'
        "BINGO B\n7 26 405873 14223455 68\n4 24 FREE 46 72 9 2036\n52 74 6 2835 49 64 6",       // 17 real example 6, but without any doubles
        "BINGO B\n7 7 26 405873 14223455 68\n13 13 24 FREE 46 72 9 2036\n52 74 9 6 2835 49 64 6", // 18 real example 6, but doubles include 2-char width
        "BINGO B\n7 7 26 405873 14223455 68\n4 4 24 FREE 46 72 11 2036\n52 74 11 6 2835 49 64 6", // 19 real example 6, but doubles include 2-char width
        "BINGO B\n7 7 26 405873 14223455 68\n13 13 24 FREE 46 72 11 2036\n52 74 11 6 2835 49 64 6", // 20 real example 6, but doubles include 2-char width
        

        "2 18425565 8 25314764 1427 5667 FREE 1322345361 4 16334862",                           // 21 real example 7

        "4 193557 62\n6 2042 51 70 13 22 48 66\n7293849 64 12345 54 73",                        // 22 real example 8    

    ];
    const expectedOutputs = [
        [1,16,31,46,61,2,17,32,47,62,3,18,0,48,63,4,19,34,49,64,5,20,35,50,65],
        [1,16,31,46,61,2,17,32,47,62,3,18,0,48,63,4,19,34,49,64,5,20,35,50,65],
        null,
        [1,16,31,46,61,2,17,32,47,62,3,18,0,48,63,4,19,34,49,64,5,20,35,50,65],
        [1,16,31,46,61,2,17,32,47,62,3,18,0,48,63,4,19,34,49,64,5,20,35,50,65],
        [1,16,31,46,61,2,17,32,47,62,3,18,0,48,63,4,19,34,49,64,5,20,35,50,65],
        [12,25,41,51,63,3,30,37,54,66,7,21,0,56,74,1,26,35,50,69,10,17,45,47,64],
        [12,25,41,51,63,3,30,37,54,66,7,21,0,56,74,1,26,35,50,69,10,17,45,47,64],
        [12,25,41,51,63,3,30,37,54,66,7,21,0,56,74,1,26,35,50,69,10,17,45,47,64],

        [7,26,40,58,73,14,22,34,55,68,4,24,0,46,72,9,20,36,52,74,6,28,35,49,64],
        [7,26,40,58,73,14,22,34,55,68,4,24,0,46,72,9,20,36,52,74,6,28,35,49,64],
        [7,26,40,58,73,14,22,34,55,68,4,24,0,46,72,9,20,36,52,74,6,28,35,49,64],
        [7,26,40,58,73,14,22,34,55,68,4,24,0,46,72,9,20,36,52,74,6,28,35,49,64],
        [7,26,40,58,73,14,22,34,55,68,4,24,0,46,72,9,20,36,52,74,6,28,35,49,64],
        [7,26,40,58,73,14,22,34,55,68,4,24,0,46,72,9,20,36,52,74,6,28,35,49,64],
        [7,26,40,58,73,14,22,34,55,68,4,24,0,46,72,9,20,36,52,74,6,28,35,49,64],
        [7,26,40,58,73,14,22,34,55,68,4,24,0,46,72,9,20,36,52,74,6,28,35,49,64],
        [7,26,40,58,73,14,22,34,55,68,4,24,0,46,72,9,20,36,52,74,6,28,35,49,64],
        [7,26,40,58,73,14,22,34,55,68,13,24,0,46,72,9,20,36,52,74,6,28,35,49,64],
        [7,26,40,58,73,14,22,34,55,68,4,24,0,46,72,11,20,36,52,74,6,28,35,49,64],
        [7,26,40,58,73,14,22,34,55,68,13,24,0,46,72,11,20,36,52,74,6,28,35,49,64],
        

        [2,18,42,55,65,8,25,31,47,64,14,27,0,56,67,13,22,34,53,61,4,16,33,48,62],

        [4,19,35,57,62,6,20,42,51,70,13,22,0,48,66,7,29,38,49,64,1,23,45,54,73],

    ];
    let fails = 0;

    testInputs.forEach((input, index) => {
        const result = parseFullOCR(input, 0, null, (index===18)?true:false);
        const passed = JSON.stringify(result) === JSON.stringify(expectedOutputs[index]);
        console.log(`Test Case ${index}:`, passed ? 'Passed' : 'Failed');
        if (!passed) {
            console.log('Expected Output:', expectedOutputs[index]);
            console.log('Program Output :', result);
            fails++;
        }
    });

    console.log(`\nTotal Passes: ${testInputs.length - fails} / ${testInputs.length}`);
    console.log(`Total Fails: ${fails}`);
    if (fails === 0) {
        console.log("\n---------------------\nALL TEST CASES PASSED!\n---------------------");
    }
}

main();