import jwt from "jsonwebtoken";
import { _User, _AADToken } from "../../models/database/user";
import { _Campus } from "../../models/database/campus";
import { _Cache } from "../../models/cache/cache";
import { getUserProfile, getCampusId, getProjectIds, getEventIds } from "../../database/user";
import { campusCache, projectCache } from "../cache";
import { Project } from "./project";

class UserCache implements _Cache<UserCache,_User>, _CacheDatabase<UserCache> {
	private dataMap: { [key: string]: _User };

	constructor() {
		this.dataMap = {};
	}

	set(item: _User): Promise<boolean> {
		return new Promise(async resolve => {
			if (item.id != "") {
				this.dataMap[item.id] = await item.init();
				return true;
			}
			return false;
		})
		
	}
	async get(id: string): Promise<_User | undefined> {
		return new Promise(async resolve => {
			resolve(this.dataMap[id]);
		})
	}
	async init():Promise<UserCache> {
		return new Promise(resolve => {
			resolve(this);
		})
	}
	clear() {return;}
}

export class User implements _User {
	id: string = "";

	name: string;
	campus: _Campus;
	preferredName: string;
	projectCount: number;
	eventCount: number;
	position: string;
	projects: Array<Project>
	eventIds: Array<string>;

	token: string = "";
	userInformation: _AADToken;
	admin: boolean;
	lead: boolean;

	constructor(jwtToken: string) {
		let tokenInfo = jwt.decode(jwtToken);
		let parsedToken: any = {};
		parsedToken = typeof tokenInfo === "string" ? JSON.parse(tokenInfo) : tokenInfo;
		this.id = parsedToken["oid"];
		this.token = jwtToken;
		parsedToken.scp = parsedToken.scp.split(" ");
		this.userInformation = parsedToken;

		this.name = this.userInformation.name;
		this.preferredName = this.userInformation.given_name;

		this.campus = {} as any;
		this.position = "";
		this.projectCount = 0;
		this.eventCount = 0;
		this.projects = [];
		this.eventIds = [];
		this
		this.admin = false;
		this.lead = false;




	}

	async init(): Promise<_User> {
		return new Promise(async resolve => {
			let queries: Array<Promise<any>> = [
				getCampusId(this.id), 
				getUserProfile(this.id),
				getProjectIds(this.id),
				getEventIds(this.id)
			];
			let responses = await Promise.all(queries);

			let campus = await campusCache.get(responses[0]);
			if(!campus) {console.error(`Campus ${responses[0]} not found when initializing user!`); return};
			this.campus = campus;
			this.admin = responses[1].admin;
			this.lead = responses[1].lead;
			this.position = responses[1].position;
			this.projectCount = responses[2].length;
			this.eventCount = responses[3].length;

			let projectIds:Array<string> = responses[3];
			projectIds.forEach(async id => {
				let project = await projectCache.get(id);
				if(!project) {console.error(`Project ${id} not found when initializing user!`); return};
				this.projects.push(project);
			})			
			//TODO load all events
			this.eventIds = responses[4];
			resolve(this);
			
		})
	}
}

export default UserCache;