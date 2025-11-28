package main.java;

import java.util.Scanner;
import main.java.GameMode.Number;
import main.java.GameMode.Roulette;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Entré votre NOM : ");
        String name = sc.nextLine();
        System.out.println();
        Player player = new Player(name);
        Roulette roulette = new Roulette();
        while (!player.bankrupt()) {
            System.out.println("MONEY = " + player.getMoney() + ".");
            System.out.println("MAX_MONEY = " + player.getMaxMoney() + ".");
            Number choice = Number.NULL;
            int sum = player.getMaxMoney()+1;
            while(!player.possibleBet(sum)) {
                System.out.print("Sum to BET : ");
                sum = Integer.getInteger(sc.nextLine());
                System.out.println();
            }
            String stringChoice;
            while(choice.equals(Number.NULL)) {
                System.out.print("Entré votre choix : ");
                stringChoice = sc.nextLine();
                System.out.println();
                for(int i=1; i<roulette.getNumbers().length-1; i++) {
                    if(roulette.getNumbers()[i].getValue().equals(stringChoice)) {
                        choice = roulette.getNumbers()[i];
                    }
                }
            }
            if(roulette.game(choice)) {
                player.addMoney(sum);
            } else {
                player.removeMoney(sum);
            }
        }
    }
}
