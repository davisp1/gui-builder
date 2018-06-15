
describe('svg_class', function () {

    it('removeClassSVG returns false when there is no classes attr', function () {

        const mockElement = {
            attr: function () {
                return null;
            },
        };
        const testClass = 'foo';

        expect(removeClassSVG(mockElement, testClass)).toBe(false);

    });

    it('removeClassSVG returns false when the element doesnt already have the class', function () {

        const mockElement = {
            attr: function () {
                return 'smeg';
            },
        };
        const testClass = 'foo';

        expect(removeClassSVG(mockElement, testClass)).toBe(false);

    });

    it('removeClassSVG returns true and removes the class when the element does have the class', function () {

        const testClass = 'foo';

        const mockElement = {
            attr: function () {
                return testClass;
            },
        };

        spyOn(mockElement, 'attr').andCallThrough();

        expect(removeClassSVG(mockElement, testClass)).toBe(true);
        expect(mockElement.attr).toHaveBeenCalledWith('class', '');

    });

    it('hasClassSVG returns false when attr returns null', function () {

        const mockElement = {
            attr: function () {
                return null;
            },
        };

        const testClass = 'foo';

        expect(hasClassSVG(mockElement, testClass)).toBe(false);

    });

    it('hasClassSVG returns false when element has no class', function () {

        const mockElement = {
            attr: function () {
                return '';
            },
        };

        const testClass = 'foo';

        expect(hasClassSVG(mockElement, testClass)).toBe(false);

    });

    it('hasClassSVG returns false when element has wrong class', function () {

        const mockElement = {
            attr: function () {
                return 'smeg';
            },
        };

        const testClass = 'foo';

        expect(hasClassSVG(mockElement, testClass)).toBe(false);

    });

    it('hasClassSVG returns true when element has correct class', function () {

        const testClass = 'foo';

        const mockElement = {
            attr: function () {
                return testClass;
            },
        };

        expect(hasClassSVG(mockElement, testClass)).toBe(true);

    });    

    it('hasClassSVG returns true when element 1 correct class of many ', function () {

        const testClass = 'foo';

        const mockElement = {
            attr: function () {
                return "whar " + testClass + " smeg";
            },
        };

        expect(hasClassSVG(mockElement, testClass)).toBe(true);
    });        
});