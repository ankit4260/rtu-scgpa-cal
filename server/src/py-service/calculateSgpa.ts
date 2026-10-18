import cr from "../data/credits_final.json" with {type: "json"};
import g from "../data/grade_points.json" with { type: "json"};

const c = cr as Record<string, number>;
const gP = g as Record<string, number>;

type sub = {
    code: string,
    name: string,
    grade: string,
}
function scgpa(s: sub[]) {
    try {
        console.log(s);
        let numinator = 0;
        let denominator = 0;
        s.forEach(e => {
            const grade = e.grade.trim();
            const code = e.code;
    
            let credit = c[code];
            const points = gP[grade];
            if((e.code).startsWith("FEC")) credit=0.5;
            if (credit === undefined) throw new Error("Unknown code: " + e.code);
            if (points === undefined) throw new Error("Unknown grade: " + e.grade);

            numinator += credit*points;
            denominator += credit;
        });

        return (numinator / denominator);

    } catch (e) {
        console.log(e);
    }

}

export {scgpa}