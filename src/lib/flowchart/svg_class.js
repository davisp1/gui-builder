//
// http://www.justinmccandless.com/blog/Patching+jQuery's+Lack+of+SVG+Support
//
// Functions to add and remove SVG classes because jQuery doesn't support this.
//

// jQuery's removeClass doesn't work for SVG, but this does!
// takes the object obj to remove from, and removes class remove
// returns true if successful, false if remove does not exist in obj
const removeClassSVG = function (obj, remove) {
    let classes = obj.attr('class');
    if (!classes) {
        return false;
    }

    const index = classes.search(remove);

    // if the class already doesn't exist, return false now
    if (index == -1) {
        return false;
    }
    else {
        // string manipulation to remove the class
        classes = classes.substring(0, index) + classes.substring((index + remove.length), classes.length);

        // set the new string as the object's class
        obj.attr('class', classes);

        return true;
    }
};

// jQuery's hasClass doesn't work for SVG, but this does!
// takes an object obj and checks for class has
// returns true if the class exits in obj, false otherwise
const hasClassSVG = function (obj, has) {
    let classes = obj.attr('class');
    if (!classes) {
        return false;
    }

    const index = classes.search(has);

    if (index == -1) {
        return false;
    }
    else {
        return true;
    }
};