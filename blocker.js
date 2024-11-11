// Example group page to run on: https://fetlife.com/groups/210991/members

// stats summary counters
let already_blocked = 0;
let new_blocks = 0;
let recently_blocked = 0;
let min_sleep = 5000;
let max_sleep = 10000;

// Time formatter
function secondsToHms(d) {
    d = Number(d);

    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    return ('0' + h).slice(-2) + ":" + ('0' + m).slice(-2) + ":" + ('0' + s).slice(-2);
}

// random sleep to try to avoid lockout
function randomSleep(min, max) {
    const time = Math.floor(Math.random() * (max - min + 1) + min); // Random time between min and max
    return new Promise(resolve => setTimeout(resolve, time));
}

// get the group title
const linkElement = document.querySelector("a.link.text-red-500.hover\\:underline");
const title = linkElement ? linkElement.title : null;

// find the the highest page number from the pagination
const totalPagesMatch = document.querySelectorAll('a[href*="page="]');
const lastPage = totalPagesMatch[totalPagesMatch.length - 2]; // the last <a> is 'next', so grab the one before it
const lastPageNumber = lastPage ? lastPage.href.match(/page=(\d+)/)[1] : null;
console.log("Total pages to fetch: "+lastPageNumber);
console.log(`Approximate time: ${secondsToHms(7.5*20*lastPageNumber)}`);

// function to block a user and add a private not to their profile
async function blockUser(myID, blockedID, formAuthenticityToken) {
    console.log(`Blocking user: ${blockedID}`)

    await randomSleep(min_sleep, max_sleep);
    // block user
    block_response = await fetch(`https://fetlife.com/users/${myID}/blockeds/from_object`, {
        method: 'POST',
        body: JSON.stringify({
            "authenticity_token":formAuthenticityToken,
            "user_id":myID,
            "blocked_object_type":"User",
            "blocked_object_id":blockedID //str
        }),
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
    });

    if (block_response.status == 302){
        console.log("UGH OH, we tripped the lockout protection. Sorry, your account is locked for 15min or so :(");
    }

    // Determine if user was already blocked
    const pageText = await block_response.text();
    if (pageText.includes('User already blocked!')) {
        console.log('  Already blocked');
        already_blocked += 1;
    } else if (pageText.includes('User was recently blocked!')) {
        console.log('  Recently unblocked, try again in 48hrs');
        recently_blocked += 1;
    } else {
        new_blocks += 1;
    }

    console.log(`  Adding note -> Part of the group: ${title}, on page ${window.location.href}`)

    // add private note to account. use previous csrf token, its accepted
    await randomSleep(min_sleep, max_sleep);
    block_response = await fetch(`https://fetlife.com/users/${myID}/profile/note`, {
        method: 'POST',
        body: JSON.stringify({
            "note":{
                "text":`Part of the group: ${title}, on page ${window.location.href}`,
                "notable_id":blockedID // int, not str
            }
        }),
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-csrf-token': formAuthenticityToken
        },
    });
    if (block_response.status == 302){
        console.log("UGH OH, we tripped the lockout protection. Sorry, your account is locked for 15min or so :(");
    }
}

// Main loop to fetch all pages and block users
for (let i = 1; i <= lastPageNumber; i++) {
    console.log(`Fetching page: ${i}/${lastPageNumber}`)
    // Grab the page
    const response = await fetch(`${window.location.href}?page=${i}`, { credentials: 'include' });
    const pageText = await response.text();

    // Parse the page content
    const parser = new DOMParser();
    const document = parser.parseFromString(pageText, 'text/html');

    // Grab the group members component
    const element = document.querySelector('div[data-component="GroupMembers"]');
    const groupInfo = JSON.parse(element.getAttribute('data-props'));

    for (const user of groupInfo.users) {
        try {
            // Fetch the page content
            await randomSleep(min_sleep, max_sleep);
            const response = await fetch(user['profilePath'], { credentials: 'include' });
            if (response.status == 302){
                console.log("UGH OH, we tripped the lockout protection. Sorry, your account is locked for 15min or so :(");
            }
            const pageText = await response.text();
            // Grab csrf token
            const tokenMatch = pageText.match(/"formAuthenticityToken":"(.*?)"/);
            const formAuthenticityToken = tokenMatch[1];

            await blockUser(FL.user.id, user['id'], formAuthenticityToken);

        } catch (error) {
            console.log(`  Error processing ${user['nickname']}:`, error);
        }
    }
}

console.log("=====================================================")
console.log(`Group: ${title}`)
console.log(`Previously Blocked: ${already_blocked}`)
console.log(`Recently Blocked (try again in 24/48hrs): ${recently_blocked}`)
console.log(`New Blocks: ${new_blocks}`)
console.log("=====================================================")
