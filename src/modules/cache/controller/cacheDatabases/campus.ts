import { _Campus } from "../../models/campus";
import { _User } from "../../models/user";
import { _Cache } from "../../models/cacheStructure";
import { _PeopleEngineCampus, _PeopleEngineUser } from "../../../database/models/_peopleEngine";


export class CampusCache implements _Cache<CampusCache, _Campus> {
    dataMap: { [key: string]: _Campus };
    private campusNames: Array<string>;

    constructor() {
        this.dataMap = {
        }
        this.campusNames = [];
        setInterval(async () => {
            await this.refresh()
        }, 60 * 60 * 1000);
    }

    set(campusObj: _Campus): Promise<boolean> {
        return new Promise(resolve => {
            this.dataMap[campusObj.id] = campusObj;
            resolve(true);
        })

    }
    getCampusNameObject(): Array<{id:string, name:string}> {
        let namesAndIds = [];
        for(let campusIndex in this.dataMap) {
            namesAndIds.push({
                id: this.dataMap[campusIndex].id,
                name: this.dataMap[campusIndex].name
            })
        }
        return namesAndIds;
    }
    async get(campusId: string): Promise<_Campus | undefined> {
        return new Promise(resolve => {
            resolve(this.dataMap[campusId]);
            //TODO load campus from database
        })
    }
    async init(): Promise<CampusCache> {
        return new Promise(async resolve => {
            let allDatabaseCampus = await PeopleEngine.getAllCampus();
            let memberQueries:Array<Promise<Array<_PeopleEngineUser>>> = [];

            for(let i = 0; i < allDatabaseCampus.length; i++) {
                memberQueries.push(PeopleEngine.getAllCampusMembers(allDatabaseCampus[i].id))
            }


            let campusMemberMap = await Promise.all(memberQueries);

            for(let i = 0; i < allDatabaseCampus.length; i++) {
                let systemCampusObj:any = {
                    id: allDatabaseCampus[i].id,
                    name: allDatabaseCampus[i].displayName,
                    memberIds: [],
                    members: [],
                    eventIds: []
                }
                if(allDatabaseCampus[i].ext5xtebhdf_mccGroupSettings) systemCampusObj.leadId = allDatabaseCampus[i].ext5xtebhdf_mccGroupSettings.leadId;
                this.campusNames.push(allDatabaseCampus[i].displayName);
                let members = campusMemberMap[i];
                let userArr:Array<_User> = [];
                for (let j = 0; j < members.length; j++) {
                    systemCampusObj.memberIds.push(members[j].id);
                    let userObj = await userCache.get(members[j].id);
                    if(userObj != undefined) {
                        userArr.push(userObj);
                    }
                }
                systemCampusObj.members = userArr;
                let systemCampus = new Campus(systemCampusObj);
                userArr.forEach(user => {
                    user.setCampus(systemCampus);
                })
                this.dataMap[systemCampus.id] = systemCampus;
            }

            resolve();
        })
    }
    async getUserCampus(userId:string):Promise<Array<_Campus>> {
        return new Promise(async resolve => {
            let cachedCampusKeyArray = Object.keys(this.dataMap);
            let userCampusQueries:Array<Promise<_Campus|undefined>> = [];
            cachedCampusKeyArray.forEach(campus => {
                userCampusQueries.push(this.dataMap[campus].isUserPartOfCampus(userId));
            })
            let lookupResults = await Promise.all(userCampusQueries);
            let userCampus:Array<_Campus> = [];
            lookupResults.forEach(result => {
                if(result) userCampus.push(result);
            })
            resolve(userCampus);
        })
    }
    exists(campusId: string): boolean {
        let campusIds = Object.keys(this.dataMap);
        if (campusIds.includes(campusId)) return true;
        return false;
    }
    clear() {
        this.dataMap = {};
        this.campusNames = [];
     }
    async refresh() {
        this.clear();
        await this.init();
     }
}

//Need import statement here as jest otherwise tries to initialize a new campus cache before parsing the class
import { PeopleEngine } from "../../../database/controllers/peopleEngineRequests";
import { userCache } from "../cacheObjects";


export class Campus implements _Campus {
    id: string;
    name: string;
    leadId: string;
    memberIds: Array<string>;
    members: Array<_User>;

    constructor(campusObj: { [key: string]: any }) {
        this.id = campusObj.aadGroupId || campusObj.id;
        this.name = campusObj.name;
        this.leadId = campusObj.leadId;
        this.memberIds = campusObj.memberIds || [];
        this.members = campusObj.members || [];
    }
    async init(): Promise<void> {
        return new Promise(async resolve => {
            let values = await PeopleEngine.getCampus(this.id);
            this.name = values.displayName;
            this.leadId = values.ext5xtebhdf_mccGroupSettings.leadId;
            let members = await PeopleEngine.getAllCampusMembers(this.id);
            members.forEach(async member => {
                this.memberIds.push(member.id);
                let user = await userCache.get(member.id);
                if(user) this.members.push(user);
            })
            resolve();
        })
    }
    async isUserPartOfCampus(userId:string):Promise<_Campus|undefined> {
        return new Promise(resolve => {
            if(this.memberIds.includes(userId)) resolve(this);
            else resolve(undefined);
        })
    }
}
