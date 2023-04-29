import { HttpClient } from '@angular/common/http';

@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
    public appPages = [
        { title: 'Map', url: '/map', icon: 'map' }
    ];

    public appLowerPages: [
        { title: 'About', url: '/about', icon: 'help-circle' }
    ];

    constructor(
        private platform: Platform,
        private storage: StorageService,
        private userService: UserService,
        private alertController: AlertController,
        private toastController: ToastController,
        private router: Router,
        private http: HttpClient,
        @Inject(MAT_DIALOG_DATA) private data: any,
        @Inject('STRING_STR') private data: any;
    ) { }

    public async testMethod(key: string, value: any) {
        await this.ionStorage?.set(key, value);
        await this.ionStorage?.also?.set(key, value);
        await this.var.func();
    }

    public testSubscribe1() {
        this.sub1.subscribe(data => {

        })

        this.subb1.subb2.subb3(param1).subscribe(data => {

        });
    }

    public testSubscribe2() {
        this.a.b.c().subscribe((params) => {
            this.testSubscribe.somefun(1).subscribe((res) => {
                this.fun();
            })
        })
    }

    public accessingAndSettingParams(param1, param2, param3) {
        param1.call();
        param2.somevalue = '';
        param3 = undefined;
    }

    public testFilterAndReturns(param) {
        let a = this.platform.filter(a => a)

        somefun()
        return data;
    }
};